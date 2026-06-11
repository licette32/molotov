//! ArtistRegistry — the minting gate for the Molotov marketplace.
//!
//! An admin-curated allowlist of the artists permitted to mint on `MolotovNft`.
//! The NFT calls `is_registered(artist)` cross-contract before every mint (see
//! `ArtistRegistryInterface` in the NFT crate); only the contract owner (the
//! admin / curator) can `register` or `revoke`.
//!
//! Access mirrors the NFT exactly: a single owner set at construction
//! (`stellar-access` Ownable), privileged calls gated by `enforce_owner_auth`.
//! Registration state is a per-artist persistent flag, kept alive with the same
//! ~30-day TTL discipline the NFT uses for its royalty/URI entries.

#![no_std]

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, Address, BytesN, Env,
};
use stellar_access::ownable::{enforce_owner_auth, set_owner, Ownable};

// TTL maintenance for the persistent per-artist flags, mirroring the NFT. Stellar
// closes a ledger roughly every 5s, so ~1 day ≈ 17280 ledgers. When a flag has
// less than ~1 day of life left we bump it back to ~30 days, so an actively used
// artist entry never expires out from under the gate. `extend_ttl` only pays rent
// — it does not rewrite the stored value.
const TTL_BUMP_THRESHOLD: u32 = 17_280; // ~1 day in ledgers
const TTL_BUMP_AMOUNT: u32 = 518_400; // ~30 days in ledgers

/// Emitted when the owner registers an artist. `artist` is a topic (indexable).
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArtistRegistered {
    #[topic]
    pub artist: Address,
}

/// Emitted when the owner revokes an artist. `artist` is a topic (indexable).
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArtistRevoked {
    #[topic]
    pub artist: Address,
}

#[contracttype]
pub enum DataKey {
    /// Per-artist registration flag. Absent = not registered.
    Registered(Address),
}

#[contract]
pub struct ArtistRegistry;

#[contractimpl]
impl ArtistRegistry {
    /// Initializes the registry with `admin` as the owner (the curator).
    ///
    /// `admin` is the only account that can `register`, `revoke`, or `upgrade`.
    /// Before mainnet this key moves to a multisig/timelock (see architecture.md
    /// §13) — whoever holds it decides who may mint.
    pub fn __constructor(e: &Env, admin: Address) {
        set_owner(e, &admin);
    }

    /// Registers `artist` so the NFT gate lets it mint. Owner-gated; idempotent
    /// (re-registering an already-registered artist is harmless).
    pub fn register(e: &Env, artist: Address) {
        enforce_owner_auth(e);
        e.storage()
            .persistent()
            .set(&DataKey::Registered(artist.clone()), &true);
        e.storage().persistent().extend_ttl(
            &DataKey::Registered(artist.clone()),
            TTL_BUMP_THRESHOLD,
            TTL_BUMP_AMOUNT,
        );
        ArtistRegistered { artist }.publish(e);
    }

    /// Revokes `artist`. Owner-gated; idempotent (revoking a non-registered
    /// artist is a no-op beyond the event). Removes the entry to free rent.
    pub fn revoke(e: &Env, artist: Address) {
        enforce_owner_auth(e);
        e.storage()
            .persistent()
            .remove(&DataKey::Registered(artist.clone()));
        ArtistRevoked { artist }.publish(e);
    }

    /// Whether `artist` is registered. This is the exact signature the NFT calls
    /// cross-contract (`ArtistRegistryInterface::is_registered`); do not rename or
    /// retype it. Never panics — an unknown artist reads `false`.
    pub fn is_registered(e: &Env, artist: Address) -> bool {
        let key = DataKey::Registered(artist);
        let registered = e
            .storage()
            .persistent()
            .get::<_, bool>(&key)
            .unwrap_or(false);
        if registered {
            // Keep an active artist's flag alive on read.
            e.storage()
                .persistent()
                .extend_ttl(&key, TTL_BUMP_THRESHOLD, TTL_BUMP_AMOUNT);
        }
        registered
    }

    /// Upgrade the contract WASM in place (SEP-49). Owner-gated.
    ///
    /// Same address, same data, new code. Mirrors the NFT's `upgrade`.
    pub fn upgrade(e: &Env, new_wasm_hash: BytesN<32>) {
        enforce_owner_auth(e);
        e.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[contractimpl(contracttrait)]
impl Ownable for ArtistRegistry {}

#[cfg(test)]
mod test;
