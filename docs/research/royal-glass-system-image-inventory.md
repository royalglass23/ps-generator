# Royal Glass system image inventory

**Scrape date:** 6 October 2026
**Source scope:** Public pages on `royalglass.co.nz` only.

## Best selector-card set

Royal Glass already publishes a consistent set of square, 800 x 800 system preview images. These are the strongest candidates for the application because their page context and alt text identify the depicted system family.

| Royal Glass system | Application | Direct image | Source page | Current PS1 options it can safely represent |
|---|---|---|---|---|
| Duo / double anchor | Glass balustrade | [Double-Anchor-Clamp-Preview.png](https://royalglass.co.nz/wp-content/uploads/2024/01/Double-Anchor-Clamp-Preview.png) | [Frameless glass balustrade](https://royalglass.co.nz/services/frameless-glass-balustrade/) | Double Disc |
| Duo / double anchor | Pool fence | [Double-Anchor-Clamp-Pool-Fence-Preview.png](https://royalglass.co.nz/wp-content/uploads/2024/01/Double-Anchor-Clamp-Pool-Fence-Preview.png) | [Frameless glass pool fence](https://royalglass.co.nz/services/frameless-glass-pool-fence/) | Double Disc, when the selected family is Pool fence |
| Pillar / square mini post | Glass balustrade | [Square-Mini-Post-Preview.png](https://royalglass.co.nz/wp-content/uploads/2024/01/Square-Mini-Post-Preview.png) | [Frameless glass balustrade](https://royalglass.co.nz/services/frameless-glass-balustrade/) | Mini Post, if Royal Glass confirms the generic option means Pillar |
| Pillar / square mini post | Pool fence | [Square-Mini-Post-Pool-Fence-Preview.png](https://royalglass.co.nz/wp-content/uploads/2024/01/Square-Mini-Post-Pool-Fence-Preview.png) | [Frameless glass pool fence](https://royalglass.co.nz/services/frameless-glass-pool-fence/) | Mini Post, when the selected family is Pool fence |
| Ward / round mini post | Glass balustrade | [Round-Mini-Post-Preview.png](https://royalglass.co.nz/wp-content/uploads/2024/01/Round-Mini-Post-Preview.png) | [Frameless glass balustrade](https://royalglass.co.nz/services/frameless-glass-balustrade/) | Mini Post, if the selector distinguishes round from square |
| Ward / round mini post | Pool fence | [Round-Mini-Post-Pool-Fence-Preview.png](https://royalglass.co.nz/wp-content/uploads/2024/01/Round-Mini-Post-Pool-Fence-Preview.png) | [Frameless glass pool fence](https://royalglass.co.nz/services/frameless-glass-pool-fence/) | Mini Post, when the selected family is Pool fence |
| Vista / aluminium channel | Glass balustrade | [Aluminium-Channel-Preview.png](https://royalglass.co.nz/wp-content/uploads/2024/01/Aluminium-Channel-Preview.png) | [Channel glass balustrade](https://royalglass.co.nz/services/channel-glass-balustrade/) | Vista; generic channel only after fixing orientation is confirmed |
| Vista / aluminium channel | Pool fence | [Aluminium-Channel-Pool-Fence-Preview.png](https://royalglass.co.nz/wp-content/uploads/2024/01/Aluminium-Channel-Pool-Fence-Preview.png) | [Frameless glass pool fence](https://royalglass.co.nz/services/frameless-glass-pool-fence/) | Vista; generic channel only after fixing orientation is confirmed |
| Elite / aluminium-framed glass | Glass balustrade | [Aluminium-Frame-Preview.png](https://royalglass.co.nz/wp-content/uploads/2024/01/Aluminium-Frame-Preview.png) | [Aluminium post glass balustrade](https://royalglass.co.nz/services/aluminium-post-glass-balustrade/) | No exact current match; do not relabel as Viking Glass without confirmation |
| Elite / aluminium-framed glass | Pool fence | [Aluminium-Frame-Pool-Fence-Preview.png](https://royalglass.co.nz/wp-content/uploads/2024/01/Aluminium-Frame-Pool-Fence-Preview.png) | [Frameless glass pool fence](https://royalglass.co.nz/services/frameless-glass-pool-fence/) | No exact current match; do not relabel as Viking Glass without confirmation |

## Additional usable image

- **Mono / single anchor or clamp:** [Single-Anchor-Clamp-Preview.png](https://royalglass.co.nz/wp-content/uploads/2024/01/Single-Anchor-Clamp-Preview.png), from Royal Glass's [Clamp Glass Balustrade System](https://royalglass.co.nz/blogs/glass-balustrade/clamp-glass-balustrade-system/) article. This does not map safely to `JH Clamp` or `Hidden Face` without confirming the intended hardware/system.

## Gaps in the current PS1 catalogue

No Royal Glass page was found that identifies a photo specifically as:

- Hidden Face
- JH Clamp
- Juralco Canopy
- Lugano
- Mini Post SP14
- Side Mount Channel as a separate named product
- Top Mount Channel as a separate named product
- UNEX Ascot
- UNEX Metropolis
- Viking Aluminium
- Viking Glass

Using a visually similar Royal Glass project photo for one of these names would imply a technical product identity that the website does not establish. Supplier-approved imagery or Royal Glass confirmation is required for those entries.

## Implementation recommendation

1. Copy approved images into the application's own `public/assets/systems/` directory instead of hotlinking WordPress/Jetpack URLs.
2. Keep separate balustrade and pool-fence photographs where Royal Glass publishes both.
3. Use the current Royal Glass customer names — Duo, Pillar, Ward, Vista and Elite — if those are the intended catalogue products.
4. Retain `Not sure` with its neutral illustration.
5. Do not publish the remaining legacy/manufacturer labels with lookalike photographs until their exact product identities are confirmed.

The public location of an image does not by itself settle internal brand approval, photographer consent, model/property-release requirements, or reuse rights. Royal Glass should confirm those before the files are copied into the production application.
