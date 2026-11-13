/**
 * Testes das Firebase Storage Security Rules.
 * Confere tenant, MIME type, tamanho máximo e caminhos de upload permitidos.
 */
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { ref, uploadBytes, getBytes, deleteObject } = require("firebase/storage");
const fs = require("fs");
const path = require("path");

const PROJECT_ID = "mayamenu-bd";
let testEnv;

async function setup() {
  const rules = fs.readFileSync(path.resolve(__dirname, "../storage.rules"), "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      rules,
      host: "127.0.0.1",
      port: 9199,
    },
  });
}

async function main() {
  await setup();
  try {
    const ownerStorage = testEnv.authenticatedContext("rest_a").storage();
    const otherStorage = testEnv.authenticatedContext("intruso").storage();
    const anonymousStorage = testEnv.unauthenticatedContext().storage();

    const menuPath = "restaurantes/rest_a/cardapio/item.jpg";
    const menuRef = ref(ownerStorage, menuPath);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

    await assertSucceeds(uploadBytes(menuRef, jpeg, { contentType: "image/jpeg" }));
    await assertSucceeds(getBytes(ref(anonymousStorage, menuPath)));
    await assertFails(uploadBytes(
      ref(otherStorage, "restaurantes/rest_a/cardapio/invasor.jpg"),
      jpeg,
      { contentType: "image/jpeg" }
    ));
    await assertFails(uploadBytes(
      ref(ownerStorage, "restaurantes/rest_a/cardapio/documento.txt"),
      jpeg,
      { contentType: "text/plain" }
    ));
    await assertFails(uploadBytes(
      ref(ownerStorage, "restaurantes/rest_a/cardapio/arquivo-grande.jpg"),
      new Uint8Array(10 * 1024 * 1024 + 1),
      { contentType: "image/jpeg" }
    ));

    await assertSucceeds(uploadBytes(
      ref(ownerStorage, "restaurantes/rest_a/equipe/membro.jpg"),
      jpeg,
      { contentType: "image/jpeg" }
    ));
    await assertFails(uploadBytes(
      ref(ownerStorage, "restaurantes/rest_a/equipe/membro.gif"),
      jpeg,
      { contentType: "image/gif" }
    ));
    await assertFails(uploadBytes(
      ref(ownerStorage, "restaurantes/rest_a/documentos/privado.pdf"),
      jpeg,
      { contentType: "application/pdf" }
    ));
    await assertFails(deleteObject(ref(otherStorage, menuPath)));
    await assertSucceeds(deleteObject(menuRef));

    console.log("Storage Rules: todos os testes passaram.");
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((error) => {
  console.error("Falha nos testes de Storage Rules:", error);
  process.exitCode = 1;
});
