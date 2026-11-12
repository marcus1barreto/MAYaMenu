/**
 * Script de Migração Controlada de PINs Legados em Texto Puro
 * Executa varredura segura em todos os restaurantes e colaboradores da subcoleção 'equipe'.
 * Converte qualquer campo `pin` em texto puro para `pinHash` e `pinSalt` via scrypt,
 * removendo permanentemente o campo `pin` em texto claro.
 */
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const crypto = require('crypto');

if (!admin.apps.length) {
  admin.initializeApp();
}

function getDb() {
  try {
    return getFirestore('mayamenu-bd');
  } catch (err) {
    return admin.firestore();
  }
}

function hashPin(pin, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(pin).trim(), salt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

async function migrarPinsLegados() {
  console.log('--- Iniciando Migração Controlada de PINs Legados ---');
  const db = getDb();

  const restsSnap = await db.collection('restaurantes').get();
  console.log(`Encontrados ${restsSnap.size} restaurantes para verificação.`);

  let totalMigrados = 0;
  let totalJaProtegidos = 0;

  for (const restDoc of restsSnap.docs) {
    const equipeSnap = await restDoc.ref.collection('equipe').get();
    if (equipeSnap.empty) continue;

    for (const membroDoc of equipeSnap.docs) {
      const data = membroDoc.data() || {};
      if (data.pin) {
        const pinTexto = String(data.pin).trim();
        const { hash, salt } = hashPin(pinTexto);

        await membroDoc.ref.update({
          pinHash: hash,
          pinSalt: salt,
          pin: admin.firestore.FieldValue.delete(),
          migradoEm: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[MIGRADO] Restaurante: ${restDoc.id} | Membro: ${membroDoc.id} (${data.nome || data.email})`);
        totalMigrados++;
      } else if (data.pinHash && data.pinSalt) {
        totalJaProtegidos++;
      }
    }
  }

  console.log('--- Conclusão da Migração ---');
  console.log(`Total de PINs legados migrados e eliminados: ${totalMigrados}`);
  console.log(`Total de registros já em formato protegido: ${totalJaProtegidos}`);
}

exports.migrarPinsLegados = migrarPinsLegados;

if (require.main === module) {
  migrarPinsLegados()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Erro na migração:', err);
      process.exit(1);
    });
}

