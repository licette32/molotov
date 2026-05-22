extern crate std;

use soroban_sdk::{
    contract, contractimpl, symbol_short,
    testutils::Address as _,
    vec, Address, Env, String, Vec,
};

use crate::{MolotovNft, MolotovNftClient, RoyaltyRecipient};

// --- Mock ArtistRegistry, used to exercise the cross-contract gate. ---
#[contract]
pub struct MockRegistry;

#[contractimpl]
impl MockRegistry {
    pub fn __constructor(e: &Env, answer: bool) {
        e.storage().instance().set(&symbol_short!("ANS"), &answer);
    }
    pub fn is_registered(e: &Env, _artist: Address) -> bool {
        e.storage().instance().get(&symbol_short!("ANS")).unwrap()
    }
}

fn placeholder(e: &Env) -> Address {
    Address::from_str(e, crate::TEMP_REGISTRY_PLACEHOLDER)
}

/// Deploy with the placeholder registry (gate disabled).
fn deploy(e: &Env) -> (MolotovNftClient<'_>, Address) {
    let admin = Address::generate(e);
    let id = e.register(
        MolotovNft,
        (
            admin.clone(),
            placeholder(e),
            String::from_str(e, "Molotov"),
            String::from_str(e, "MOLO"),
        ),
    );
    (MolotovNftClient::new(e, &id), admin)
}

fn one_recipient(e: &Env, who: &Address) -> Vec<RoyaltyRecipient> {
    vec![
        e,
        RoyaltyRecipient {
            address: who.clone(),
            share_bps: 10_000,
        },
    ]
}

// ============================ Happy path ============================

#[test]
fn test_mint_with_valid_royalty() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);

    let artist = Address::generate(&e);
    let uri = String::from_str(&e, "ipfs://obra-1");
    let recipients = one_recipient(&e, &artist);

    let token_id = client.mint(&artist, &artist, &uri, &1000u32, &recipients);

    // Storage.
    assert_eq!(client.royalty_bps(&token_id), 1000);
    assert_eq!(client.owner_of(&token_id), artist);
    assert_eq!(client.token_uri(&token_id), uri);

    // 100 XLM sale -> 10% -> 10 XLM, all to the single recipient.
    let info = client.get_royalty_info(&token_id, &1_000_000_000i128);
    assert_eq!(info.len(), 1);
    assert_eq!(info.get(0).unwrap(), (artist.clone(), 100_000_000i128));

    // Note: the Minted event is published by the contract (verified live in the
    // smoke test). soroban-sdk 25.3's unit-test env does not surface contract
    // events via events().all(), so we assert storage here, not the event.
}

#[test]
fn test_mint_with_royalty_split() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);

    let artist = Address::generate(&e);
    let r0 = Address::generate(&e);
    let r1 = Address::generate(&e);
    let r2 = Address::generate(&e);
    let recipients = vec![
        &e,
        RoyaltyRecipient { address: r0.clone(), share_bps: 5000 },
        RoyaltyRecipient { address: r1.clone(), share_bps: 3000 },
        RoyaltyRecipient { address: r2.clone(), share_bps: 2000 },
    ];

    let token_id = client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://obra-split"),
        &1200u32,
        &recipients,
    );

    // 100 XLM sale -> 12% -> 12 XLM total, split 50/30/20.
    let info = client.get_royalty_info(&token_id, &1_000_000_000i128);
    assert_eq!(info.len(), 3);
    assert_eq!(info.get(0).unwrap(), (r0, 60_000_000i128));
    assert_eq!(info.get(1).unwrap(), (r1, 36_000_000i128));
    assert_eq!(info.get(2).unwrap(), (r2, 24_000_000i128));

    // The sum closes exactly against the total (no rounding leak).
    let total: i128 = info.get(0).unwrap().1 + info.get(1).unwrap().1 + info.get(2).unwrap().1;
    assert_eq!(total, 120_000_000i128);
}

#[test]
fn test_transfer() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);

    let artist = Address::generate(&e);
    let collector_a = Address::generate(&e);
    let collector_b = Address::generate(&e);
    let token_id = client.mint(
        &artist,
        &collector_a,
        &String::from_str(&e, "ipfs://obra-t"),
        &1000u32,
        &one_recipient(&e, &artist),
    );

    assert_eq!(client.owner_of(&token_id), collector_a);
    client.transfer(&collector_a, &collector_b, &token_id);
    assert_eq!(client.owner_of(&token_id), collector_b);
}

#[test]
fn test_burn() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);

    let owner = Address::generate(&e);
    let token_id = client.mint(
        &owner,
        &owner,
        &String::from_str(&e, "ipfs://obra-b"),
        &1000u32,
        &one_recipient(&e, &owner),
    );

    client.burn(&owner, &token_id);
    // owner_of must fail for a burned token.
    assert!(client.try_owner_of(&token_id).is_err());
}

// ============================ Error cases ============================

#[test]
#[should_panic]
fn test_mint_rejects_royalty_below_min() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);
    client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://x"),
        &99u32,
        &one_recipient(&e, &artist),
    );
}

#[test]
#[should_panic]
fn test_mint_rejects_royalty_above_max() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);
    client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://x"),
        &1501u32,
        &one_recipient(&e, &artist),
    );
}

#[test]
#[should_panic]
fn test_mint_rejects_split_not_summing_10000() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);
    let recipients = vec![
        &e,
        RoyaltyRecipient { address: Address::generate(&e), share_bps: 4000 },
        RoyaltyRecipient { address: Address::generate(&e), share_bps: 4000 },
        RoyaltyRecipient { address: Address::generate(&e), share_bps: 1000 },
    ];
    client.mint(&artist, &artist, &String::from_str(&e, "ipfs://x"), &1000u32, &recipients);
}

#[test]
#[should_panic]
fn test_mint_rejects_unregistered_artist() {
    let e = Env::default();
    e.mock_all_auths();
    // Real (mock) registry that answers `false` for everyone.
    let registry = e.register(MockRegistry, (false,));
    let admin = Address::generate(&e);
    let id = e.register(
        MolotovNft,
        (
            admin,
            registry,
            String::from_str(&e, "Molotov"),
            String::from_str(&e, "MOLO"),
        ),
    );
    let client = MolotovNftClient::new(&e, &id);
    let artist = Address::generate(&e);
    client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://x"),
        &1000u32,
        &one_recipient(&e, &artist),
    );
}

#[test]
fn test_mint_accepts_registered_artist() {
    let e = Env::default();
    e.mock_all_auths();
    // Mock registry that answers `true`: the gate lets the mint through.
    let registry = e.register(MockRegistry, (true,));
    let admin = Address::generate(&e);
    let id = e.register(
        MolotovNft,
        (
            admin,
            registry,
            String::from_str(&e, "Molotov"),
            String::from_str(&e, "MOLO"),
        ),
    );
    let client = MolotovNftClient::new(&e, &id);
    let artist = Address::generate(&e);
    let token_id = client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://ok"),
        &1000u32,
        &one_recipient(&e, &artist),
    );
    assert_eq!(client.owner_of(&token_id), artist);
}

#[test]
#[should_panic]
fn test_set_default_royalty_is_immutable() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);
    client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://x"),
        &1000u32,
        &one_recipient(&e, &artist),
    );
    // Must panic: ROYALTIES_IMMUTABLE_AFTER_MINT.
    client.set_default_royalty(&artist, &500u32);
}

#[test]
#[should_panic]
fn test_set_token_royalty_is_immutable() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);
    let token_id = client.mint(
        &artist,
        &artist,
        &String::from_str(&e, "ipfs://x"),
        &1000u32,
        &one_recipient(&e, &artist),
    );
    // Must panic: ROYALTIES_IMMUTABLE_AFTER_MINT.
    client.set_token_royalty(&token_id, &artist, &500u32);
}

#[test]
#[should_panic]
fn test_burn_by_non_owner_fails() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let owner = Address::generate(&e);
    let stranger = Address::generate(&e);
    let token_id = client.mint(
        &owner,
        &owner,
        &String::from_str(&e, "ipfs://x"),
        &1000u32,
        &one_recipient(&e, &owner),
    );
    client.burn(&stranger, &token_id);
}
