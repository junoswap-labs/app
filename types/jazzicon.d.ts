// @metamask/jazzicon ships no type declarations; it returns a rendered identicon
// element from a diameter (px) and a numeric seed derived from the address.
declare module '@metamask/jazzicon' {
    export default function jazzicon(diameter: number, seed: number): HTMLElement
}
