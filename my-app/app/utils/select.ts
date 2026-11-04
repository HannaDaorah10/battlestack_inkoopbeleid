/**
 * Gedeelde `content`-instelling voor elke `<USelect>` in de app: `:content="SELECT_CONTENT"`.
 *
 * De Select van reka-ui zet standaard `pointer-events: none` op de hele pagina zolang de lijst
 * open is, en dat blijft zo tot de sluitanimatie voorbij is. Een klik vlak na het kiezen (op
 * "Voeg drempelcategorie toe", of in een tekstveld) viel daardoor weg: de eerste klik deed
 * niets, de tweede wel. Met deze instelling sluit een klik buiten de lijst hem gewoon en komt de
 * klik ook aan waar hij bedoeld was.
 *
 * Alleen nodig voor `USelect`: `USelectMenu` en `UInputMenu` (Combobox) blokkeren standaard niet.
 */
export const SELECT_CONTENT = { disableOutsidePointerEvents: false } as const
