// Envía el mensaje de buenos días a todos los dispositivos con notificaciones activadas.
// Lo lanza .github/workflows/buenos-dias.yml. Una frase por día, rotando.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const FRASES = [
  ["Nuevo día.", "Hoy cuenta igual que ayer. No lo regales."],
  ["Un día más.", "Recuerda lo que tienes y agradécelo. Luego, a por ello."],
  ["Arriba.", "Otro día en el contador. Que no sea el que rompe la racha."],
  ["Respira.", "Ser productivo también es tumbarse en la playa a mirar las olas. Hoy haz tu rato y disfruta del resto."],
  ["Buenos días.", "24 horas por delante. Con una o dos bien usadas basta."],
  ["Hoy es un regalo.", "No todo el mundo lo tiene. Úsalo bien."],
  ["Empieza el día.", "Los tres juntos, ninguno se queda atrás."],
  ["Antes de empezar.", "Piensa en una cosa por la que dar las gracias hoy. Después, a por ello."],
  ["Otro día, otra oportunidad.", "Lo de ayer ya está. Lo de hoy depende de ti."],
  ["No todo es hacer.", "Un paseo sin prisa también es tiempo bien usado. Lo importante es que el día no se te escape sin darte cuenta."],
  ["Arranca.", "Cuanto antes lo hagas, antes te lo quitas de encima."],
  ["Otro día para aprovechar.", "Agradece lo que tienes y demuéstralo con lo que haces."],
];
const APP = "https://nicolopezfrr.github.io/tiempo-util/";

const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
  .formatToParts(new Date()).map(x => [x.type, x.value]));
const hoy = `${p.year}-${p.month}-${p.day}`, hora = Number(p.hour);
const prueba = process.env.PRUEBA === "true";

// El workflow se lanza a dos horas UTC para cubrir horario de verano e invierno:
// solo envía la primera vez que en España son entre las 6:00 y las 8:59.
if (!prueba && (hora < 6 || hora >= 9)) { console.log(`En España son las ${hora} h: no toca.`); process.exit(0); }

initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
const db = getFirestore();
const estado = db.doc("config/push");
if (!prueba && (await estado.get()).data()?.lastMorning === hoy) { console.log("Hoy ya se envió."); process.exit(0); }

const dia = Math.round(Date.parse(hoy + "T00:00:00Z") / 86400000);
const [title, body] = FRASES[dia % FRASES.length];
const docs = (await db.collection("tokens").get()).docs.filter(d => d.data().token);
console.log(`${hoy}: «${title} ${body}» → ${docs.length} dispositivos${prueba ? " (prueba)" : ""}`);

if (docs.length) {
  const res = await getMessaging().sendEachForMulticast({
    tokens: docs.map(d => d.data().token),
    webpush: { notification: { title, body, icon: APP + "icon-192.png" }, fcmOptions: { link: APP } },
  });
  console.log(`Enviados: ${res.successCount}. Fallidos: ${res.failureCount}.`);
  // Borra los dispositivos que ya no existen (app desinstalada, permiso retirado…).
  const caducados = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"];
  await Promise.all(res.responses.map((r, i) => {
    if (r.success) return null;
    console.log(`- ${docs[i].data().person || "?"}: ${r.error?.code}`);
    return caducados.includes(r.error?.code) ? docs[i].ref.delete() : null;
  }));
}
if (!prueba) await estado.set({ lastMorning: hoy }, { merge: true });
