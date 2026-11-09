// Firebase Cloud Function – atribui custom claims ao criar um restaurante
// Este arquivo deve ser incluído no seu projeto de Functions (ex.: `functions/`)
// e implantado com `firebase deploy --only functions`.
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * Quando um documento em `restaurantes/{restId}` é criado, define o claim `owner`
 * no UID do usuário que criou o restaurante (campo `ownerId`).
 * Também pode criar claims vazios para `garcom` e `cozinha` que serão
 * atribuídos posteriormente via UI de gestão de equipe.
 */
export const setRestaurantOwnerClaims = functions.firestore
  .document("restaurantes/{restId}")
  .onCreate(async (snap, context) => {
    const data = snap.data() as any;
    const ownerUid = data?.ownerId;
    if (!ownerUid) {
      console.warn("Documento de restaurante criado sem ownerId.");
      return null;
    }

    try {
      // Define claims: owner = true; garcom/cozinha = false (padrão)
      const claims = { role: "owner" };
      await admin.auth().setCustomUserClaims(ownerUid, claims);
      console.info(`Custom claim 'owner' atribuído ao UID ${ownerUid}`);
    } catch (error) {
      console.error("Erro ao definir custom claims:", error);
    }
    return null;
  });

