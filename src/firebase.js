import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBO7jXhm2R7_3vr-AmMP8pDsxDeIXuU2ok",
  authDomain: "ridgeline-duo.firebaseapp.com",
  projectId: "ridgeline-duo",
  storageBucket: "ridgeline-duo.firebasestorage.app",
  messagingSenderId: "374148925217",
  appId: "1:374148925217:web:4011b2f301150442052060",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Firestore doc IDs can't contain "/", so encode our ":" delimited keys safely.
const safeId = (key) => encodeURIComponent(key);

export async function dGet(key) {
  try {
    const snap = await getDoc(doc(db, "entries", safeId(key)));
    return snap.exists() ? JSON.parse(snap.data().value) : null;
  } catch (e) {
    console.error("dGet failed", key, e);
    return null;
  }
}

export async function dSet(key, value) {
  try {
    await setDoc(doc(db, "entries", safeId(key)), {
      key,
      value: JSON.stringify(value),
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error("dSet failed", key, e);
  }
}

// Returns the original (decoded) keys matching a prefix, e.g. "weighins:Alex:"
export async function dListPrefix(prefix) {
  try {
    const q = query(
      collection(db, "entries"),
      where("key", ">=", prefix),
      where("key", "<", prefix + "\uf8ff")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data().key);
  } catch (e) {
    console.error("dListPrefix failed", prefix, e);
    return [];
  }
}

// Device-local identity ("who am I on this phone") - not shared, uses localStorage.
export function getWhoAmI() {
  return localStorage.getItem("ridgeline_whoami");
}
export function setWhoAmI(name) {
  localStorage.setItem("ridgeline_whoami", name);
}
