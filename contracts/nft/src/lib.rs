//! MolotovNFT — contrato NFT de producción del marketplace Molotov.
//!
//! Tres diferenciales del producto, grabados en el contrato:
//!   1. Royalties **inmutables**: la config de regalías se fija en el minteo y
//!      no puede modificarse nunca. No hay setters; los stubs heredables de la
//!      base panickean con `RoyaltiesImmutableAfterMint`.
//!   2. Split **multi-wallet**: el royalty se reparte entre N destinatarios,
//!      cada uno con su porción en basis points (suma = 10000).
//!   3. Mint **gated** por el ArtistRegistry vía cross-contract. Hasta el
//!      Paso 7 el registry es un placeholder que desactiva el gate.
//!
//! SEP-50 core (transfer, burn, owner_of, balance, token_uri) viene de la base
//! OpenZeppelin; `token_uri` se sobreescribe para servir URIs IPFS por token.

#![no_std]

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, Address, Env, String, Vec,
};
use stellar_access::ownable::{set_owner, Ownable};
use stellar_tokens::non_fungible::{burnable::NonFungibleBurnable, Base, NonFungibleToken};

/// Registry placeholder: contract id all-zeros (contrato inexistente). Mientras
/// el NFT apunte acá, el gate de artistas está desactivado. Se reemplaza por el
/// ArtistRegistry real en el Paso 7.
const TEMP_REGISTRY_PLACEHOLDER: &str =
    "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

const MIN_ROYALTY_BPS: u32 = 100; // 1%
const MAX_ROYALTY_BPS: u32 = 1500; // 15%
const BPS_DENOMINATOR: i128 = 10_000; // 100%

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MolotovError {
    RoyaltyTooLow = 1,
    RoyaltyTooHigh = 2,
    ShareNotPositive = 3,
    SharesMustSumTo10000 = 4,
    NoRecipients = 5,
    ArtistNotRegistered = 6,
    RoyaltiesImmutableAfterMint = 7,
    RoyaltyConfigMissing = 8,
    MathOverflow = 9,
}

/// Una porción del royalty para un destinatario.
#[contracttype]
#[derive(Clone)]
pub struct RoyaltyRecipient {
    pub address: Address,
    pub share_bps: u32,
}

/// Config de royalty de un token: total en bps + reparto entre destinatarios.
#[contracttype]
#[derive(Clone)]
pub struct RoyaltyConfig {
    pub total_bps: u32,
    pub recipients: Vec<RoyaltyRecipient>,
}

/// Evento estructurado emitido al mintear. `token_id` es topic (indexable).
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MintedEvent {
    #[topic]
    pub token_id: u32,
    pub artist: Address,
    pub recipient: Address,
    pub royalty_bps: u32,
    pub recipients_count: u32,
}

#[contracttype]
pub enum DataKey {
    Registry,
    TokenUri(u32),
    Royalty(u32),
}

/// Interfaz del ArtistRegistry (lo implementa el contrato del Paso 7). Sólo se
/// usa para generar el client cross-contract `ArtistRegistryClient`.
#[contractclient(name = "ArtistRegistryClient")]
pub trait ArtistRegistryInterface {
    fn is_registered(e: Env, artist: Address) -> bool;
}

#[contract]
pub struct MolotovNft;

#[contractimpl]
impl MolotovNft {
    /// Inicializa la colección.
    ///
    /// `admin` queda como owner SÓLO para upgrades / cambios de treasury, nunca
    /// para tocar royalties. `registry` es el ArtistRegistry (o el placeholder).
    pub fn __constructor(
        e: &Env,
        admin: Address,
        registry: Address,
        name: String,
        symbol: String,
    ) {
        set_owner(e, &admin);
        // base_uri vacío: cada token trae su propia URI IPFS (ver `token_uri`).
        Base::set_metadata(e, String::from_str(e, ""), name, symbol);
        e.storage().instance().set(&DataKey::Registry, &registry);
    }

    /// Mintea un token a `recipient`, atribuido al `artist`, con su URI IPFS y
    /// su config de royalty inmutable. Devuelve el `token_id` secuencial.
    pub fn mint(
        e: &Env,
        artist: Address,
        recipient: Address,
        token_uri: String,
        royalty_bps: u32,
        recipients: Vec<RoyaltyRecipient>,
    ) -> u32 {
        artist.require_auth();

        // 1. Gate: el artista debe estar registrado (salvo placeholder).
        Self::require_registered_artist(e, &artist);

        // 2. Validación del royalty.
        if royalty_bps < MIN_ROYALTY_BPS {
            panic_with_error!(e, MolotovError::RoyaltyTooLow);
        }
        if royalty_bps > MAX_ROYALTY_BPS {
            panic_with_error!(e, MolotovError::RoyaltyTooHigh);
        }
        if recipients.is_empty() {
            panic_with_error!(e, MolotovError::NoRecipients);
        }
        let mut sum: u32 = 0;
        for r in recipients.iter() {
            if r.share_bps == 0 {
                panic_with_error!(e, MolotovError::ShareNotPositive);
            }
            sum = sum
                .checked_add(r.share_bps)
                .unwrap_or_else(|| panic_with_error!(e, MolotovError::MathOverflow));
        }
        if sum != BPS_DENOMINATOR as u32 {
            panic_with_error!(e, MolotovError::SharesMustSumTo10000);
        }

        // 3. Mint con id secuencial.
        let token_id = Base::sequential_mint(e, &recipient);

        // 4. Persistir URI + config de royalty (inmutable a partir de acá).
        e.storage()
            .persistent()
            .set(&DataKey::TokenUri(token_id), &token_uri);
        let recipients_count = recipients.len();
        let config = RoyaltyConfig { total_bps: royalty_bps, recipients };
        e.storage()
            .persistent()
            .set(&DataKey::Royalty(token_id), &config);

        // 5. Evento estructurado.
        MintedEvent {
            token_id,
            artist,
            recipient,
            royalty_bps,
            recipients_count,
        }
        .publish(e);

        token_id
    }

    /// Reparto del royalty para una venta: lista de `(recipient, monto_stroops)`.
    /// El marketplace (Paso 8) la usa para distribuir.
    ///
    /// `total = sale_price * total_bps / 10000`; cada porción es
    /// `total * share_bps / 10000`. El último destinatario absorbe el dust de
    /// redondeo para garantizar que la suma de montos == total.
    pub fn get_royalty_info(e: &Env, token_id: u32, sale_price: i128) -> Vec<(Address, i128)> {
        let config = Self::royalty_config(e, token_id);
        let total_amount = mul_div(e, sale_price, config.total_bps as i128, BPS_DENOMINATOR);

        let mut out: Vec<(Address, i128)> = Vec::new(e);
        let n = config.recipients.len();
        let mut distributed: i128 = 0;
        for i in 0..n {
            let r = config.recipients.get(i).unwrap();
            let amount = if i == n - 1 {
                // último: el remanente, así la suma cierra exacto contra `total`.
                total_amount
                    .checked_sub(distributed)
                    .unwrap_or_else(|| panic_with_error!(e, MolotovError::MathOverflow))
            } else {
                let a = mul_div(e, total_amount, r.share_bps as i128, BPS_DENOMINATOR);
                distributed = distributed
                    .checked_add(a)
                    .unwrap_or_else(|| panic_with_error!(e, MolotovError::MathOverflow));
                a
            };
            out.push_back((r.address, amount));
        }
        out
    }

    /// Royalty total en bps de un token (lectura).
    pub fn royalty_bps(e: &Env, token_id: u32) -> u32 {
        Self::royalty_config(e, token_id).total_bps
    }

    /// Dirección del ArtistRegistry configurado.
    pub fn registry(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Registry).unwrap()
    }

    // --- Guardas de inmutabilidad: el royalty NUNCA cambia post-mint. ---
    // Stubs por si alguien intenta el camino estándar ERC2981; siempre panickean.

    pub fn set_default_royalty(e: &Env, _receiver: Address, _basis_points: u32) {
        panic_with_error!(e, MolotovError::RoyaltiesImmutableAfterMint);
    }

    pub fn set_token_royalty(
        e: &Env,
        _token_id: u32,
        _receiver: Address,
        _basis_points: u32,
    ) {
        panic_with_error!(e, MolotovError::RoyaltiesImmutableAfterMint);
    }

    // --- internos ---

    fn royalty_config(e: &Env, token_id: u32) -> RoyaltyConfig {
        e.storage()
            .persistent()
            .get(&DataKey::Royalty(token_id))
            .unwrap_or_else(|| panic_with_error!(e, MolotovError::RoyaltyConfigMissing))
    }

    fn require_registered_artist(e: &Env, artist: &Address) {
        let registry: Address = e.storage().instance().get(&DataKey::Registry).unwrap();
        let placeholder = Address::from_str(e, TEMP_REGISTRY_PLACEHOLDER);
        if registry == placeholder {
            return; // gate desactivado hasta el Paso 7
        }
        if !ArtistRegistryClient::new(e, &registry).is_registered(artist) {
            panic_with_error!(e, MolotovError::ArtistNotRegistered);
        }
    }
}

#[contractimpl(contracttrait)]
impl NonFungibleToken for MolotovNft {
    type ContractType = Base;

    /// Override: devuelve la URI IPFS guardada por token (no base_uri + id).
    fn token_uri(e: &Env, token_id: u32) -> String {
        let _ = Base::owner_of(e, token_id); // panickea si el token no existe
        e.storage()
            .persistent()
            .get(&DataKey::TokenUri(token_id))
            .unwrap_or_else(|| Base::token_uri(e, token_id))
    }
}

#[contractimpl(contracttrait)]
impl NonFungibleBurnable for MolotovNft {}

#[contractimpl(contracttrait)]
impl Ownable for MolotovNft {}

/// `a * b / denom` con checked mul/div; panickea en overflow.
fn mul_div(e: &Env, a: i128, b: i128, denom: i128) -> i128 {
    a.checked_mul(b)
        .unwrap_or_else(|| panic_with_error!(e, MolotovError::MathOverflow))
        .checked_div(denom)
        .unwrap_or_else(|| panic_with_error!(e, MolotovError::MathOverflow))
}

#[cfg(test)]
mod test;
