<!--
  Zet elke inkoopbeleid-pagina achter een organisatie-identiteit: geen organisatie bekend, dan
  het "wie ben jij"-scherm; wel bekend, dan gewoon de pagina-inhoud. Een child kan altijd
  aannemen dat `organisationId` gezet is zodra zijn eigen inhoud gerenderd wordt.
-->
<template>
    <OrganisationIdentityGate v-if="!organisationId" />
    <slot v-else />
</template>

<script setup lang="ts">
const { organisationId } = await useOrganisations()
</script>
