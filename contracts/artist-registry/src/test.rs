extern crate std;

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

use crate::{ArtistRegistry, ArtistRegistryClient};

/// Deploy the registry with a fresh owner (admin/curator).
fn deploy(e: &Env) -> (ArtistRegistryClient<'_>, Address) {
    let admin = Address::generate(e);
    let id = e.register(ArtistRegistry, (admin.clone(),));
    (ArtistRegistryClient::new(e, &id), admin)
}

// ============================ is_registered ============================

/// A fresh registry knows no one: any address reads `false`, no panic.
#[test]
fn test_unregistered_artist_reads_false() {
    let e = Env::default();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);
    assert!(!client.is_registered(&artist));
}

// ============================== register ==============================

/// The owner registers an artist; `is_registered` then reflects it.
#[test]
fn test_register_marks_artist() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);

    client.register(&artist);
    assert!(client.is_registered(&artist));
}

/// Registering is idempotent: a second register leaves the artist registered.
#[test]
fn test_register_is_idempotent() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);

    client.register(&artist);
    client.register(&artist);
    assert!(client.is_registered(&artist));
}

/// Registration is per-artist: registering one does not register another.
#[test]
fn test_register_is_scoped_per_artist() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let a = Address::generate(&e);
    let b = Address::generate(&e);

    client.register(&a);
    assert!(client.is_registered(&a));
    assert!(!client.is_registered(&b));
}

/// `register` requires the owner's auth (no auth mocked -> panics).
#[test]
#[should_panic]
fn test_register_requires_owner_auth() {
    let e = Env::default();
    let (client, _admin) = deploy(&e); // construction needs no auth
    let artist = Address::generate(&e);
    client.register(&artist);
}

// =============================== revoke ===============================

/// Register then revoke: the artist ends up not registered.
#[test]
fn test_revoke_clears_artist() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);

    client.register(&artist);
    assert!(client.is_registered(&artist));

    client.revoke(&artist);
    assert!(!client.is_registered(&artist));
}

/// Revoking a never-registered artist is a harmless no-op (stays false).
#[test]
fn test_revoke_unregistered_is_noop() {
    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);

    client.revoke(&artist);
    assert!(!client.is_registered(&artist));
}

/// `revoke` requires the owner's auth (no auth mocked -> panics).
#[test]
#[should_panic]
fn test_revoke_requires_owner_auth() {
    let e = Env::default();
    let (client, _admin) = deploy(&e); // construction needs no auth
    let artist = Address::generate(&e);
    client.revoke(&artist);
}

// =============================== upgrade ==============================

/// `upgrade` requires the owner's auth: with no auth mocked the owner check
/// panics before any WASM swap is attempted.
#[test]
#[should_panic]
fn test_upgrade_requires_owner_auth() {
    let e = Env::default();
    let (client, _admin) = deploy(&e); // construction needs no auth
    let dummy_hash = BytesN::from_array(&e, &[0u8; 32]);
    client.upgrade(&dummy_hash);
}

// ================================ TTL ================================

/// `register` bumps the persistent flag to the ~30-day TTL, and reading a
/// registered artist via `is_registered` keeps it bumped.
#[test]
fn test_register_and_read_extend_persistent_ttl() {
    use crate::{DataKey, TTL_BUMP_AMOUNT};
    use soroban_sdk::testutils::storage::Persistent as _;
    use soroban_sdk::testutils::Ledger as _;

    let e = Env::default();
    e.mock_all_auths();
    let (client, _admin) = deploy(&e);
    let artist = Address::generate(&e);
    let contract_id = client.address.clone();

    client.register(&artist);

    // The flag got the ~30-day TTL at registration.
    let key = DataKey::Registered(artist.clone());
    let ttl_after_register =
        e.as_contract(&contract_id, || e.storage().persistent().get_ttl(&key));
    assert!(
        ttl_after_register >= TTL_BUMP_AMOUNT - 16,
        "register ttl too low: {}",
        ttl_after_register
    );

    // Advance close to expiry, then an `is_registered` read should bump it back up.
    e.ledger().with_mut(|l| l.sequence_number += TTL_BUMP_AMOUNT - 100);
    assert!(client.is_registered(&artist));
    let ttl_after_read = e.as_contract(&contract_id, || e.storage().persistent().get_ttl(&key));
    assert!(
        ttl_after_read >= TTL_BUMP_AMOUNT - 16,
        "ttl not re-bumped on read: {}",
        ttl_after_read
    );
}
