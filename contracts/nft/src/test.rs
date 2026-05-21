extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::{MolotovNft, MolotovNftClient};

fn setup(e: &Env) -> (MolotovNftClient<'_>, Address) {
    let owner = Address::generate(e);
    let contract_id = e.register(
        MolotovNft,
        (
            owner.clone(),
            String::from_str(e, "ipfs://collection-metadata"),
            String::from_str(e, "Molotov"),
            String::from_str(e, "MOLO"),
            500u32,
        ),
    );
    (MolotovNftClient::new(e, &contract_id), owner)
}

#[test]
fn constructor_sets_metadata_and_owner() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, owner) = setup(&e);

    assert_eq!(client.name(), String::from_str(&e, "Molotov"));
    assert_eq!(client.symbol(), String::from_str(&e, "MOLO"));
    assert_eq!(client.get_owner(), Some(owner));
}

#[test]
fn owner_mints_sequentially() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _owner) = setup(&e);
    let alice = Address::generate(&e);

    client.mint(&alice);
    client.mint(&alice);

    assert_eq!(client.balance(&alice), 2);
    assert_eq!(client.total_supply(), 2);
}

#[test]
fn owner_burns_held_token() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _owner) = setup(&e);
    let alice = Address::generate(&e);

    let token_id = client.mint(&alice);
    client.burn(&alice, &token_id);

    assert_eq!(client.balance(&alice), 0);
    assert_eq!(client.total_supply(), 0);
}
