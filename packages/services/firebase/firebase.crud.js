// ============================================================
// FIREBASE.CRUD.JS — Operações atômicas no Firestore
// Responsabilidade única: CRUD de documentos individuais.
// Sem lógica de sync, storage ou listeners.
// ============================================================

import { db, firebaseReady } from './firebase.init.js';
import { getFamilyId } from '../../core/state/store.js';

export async function saveToFirebase(collection, item) {
  if (!firebaseReady) return;
  try {
    const familyId = getFamilyId();
    if (!familyId) { console.warn(`Sem familyId — item ${item.id} não será salvo no Firebase.`); return; }
    await db.collection(collection).doc(item.id).set({ ...item, familyId });
  } catch (error) {
    console.error(`Erro ao salvar no Firebase (${collection}):`, error);
  }
}

export async function deleteFromFirebase(collection, id) {
  if (!firebaseReady) return;
  try {
    await db.collection(collection).doc(id).delete();
  } catch (error) {
    console.error(`Erro ao deletar do Firebase (${collection}):`, error);
  }
}

export async function updateInFirebase(collection, id, data) {
  if (!firebaseReady) return;
  try {
    await db.collection(collection).doc(id).update(data);
  } catch (error) {
    console.error(`Erro ao atualizar no Firebase (${collection}):`, error);
  }
}
