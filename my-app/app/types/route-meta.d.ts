/**
 * Extra velden op `definePageMeta`.
 *
 * `fullBleed` bestaat omdat de standaardlayout elke pagina in een kolom van 1080px zet met
 * eigen padding. Dat klopt voor een dashboardpagina, maar niet voor een scherm dat zijn eigen
 * randen meebrengt, zoals de begeleide route met een donkere routebalk tegen de linkerrand.
 */
declare module 'vue-router' {
    interface RouteMeta {
        /** Laat de layout de breedtebegrenzing en de padding weg voor deze pagina. */
        fullBleed?: boolean
    }
}

export {}
