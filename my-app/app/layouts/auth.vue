<template>
    <div class="flex min-h-screen items-center justify-center px-4 py-10">
        <!-- Geen achtergrondkleur op de wrapper: de pagina is Lichtgrijs (op body),
             wit is voorbehouden aan de kaart erin. -->
        <div class="w-full max-w-4xl">
            <div class="grid grid-cols-1 overflow-hidden rounded-lg bg-default ring ring-default md:grid-cols-2">
                <div class="flex flex-col justify-center p-6 sm:p-10">
                    <slot />
                </div>

                <!-- Inkt-vlak met het diapositieve logo: donkere vlakken zijn er voor
                     oriëntatie, niet voor content — precies wat dit paneel doet. -->
                <div class="relative hidden bg-inverted md:block">
                    <img
                        src="/img/auth-cover.svg"
                        alt=""
                        class="h-full w-full object-cover"
                        aria-hidden="true"
                    />
                    <div class="absolute inset-0 flex flex-col justify-between p-10">
                        <img
                            src="/img/adjust-logo-diap.png"
                            alt="Adjust"
                            class="w-[104px]"
                        />
                        <p class="max-w-[16rem] text-lg font-semibold text-white">
                            {{ t('auth.cover.tagline') }}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
</script>
