// Guardar y borrar movimientos, manteniendo enlazadas las aportaciones personales al Hogar.
import { contribOps } from './space.js';

export async function saveMovement({ space, user, before, data, contribConcept }) {
  const editing = !!before?.id;
  const id = editing ? before.id : space.newId();
  const ops = [editing
    ? { type: 'update', path: space.path('transactions', id), data: { ...data, updatedBy: user.email }, stamp: 'update' }
    : { type: 'set', path: space.path('transactions', id), data: { ...data, createdBy: user.email }, stamp: 'create' }];
  if (space.kind === 'personal') ops.push(...contribOps({ before, after: data, personalTxId: id, user, concept: contribConcept }));
  await space.commit(ops);
  return id;
}

export async function deleteMovement({ space, user, tx }) {
  const ops = [{ type: 'delete', path: space.path('transactions', tx.id) }];
  if (space.kind === 'personal') ops.push(...contribOps({ before: tx, after: null, personalTxId: tx.id, user }));
  await space.commit(ops);
}
