import {firebaseConfig} from './firebase-config.js';
let api=null,auth=null,db=null,currentUser=null,unsubscribe=null;
export const configured=!!firebaseConfig?.projectId;
export async function connect(onSession,onItems,onError){
 if(!configured){onSession(null);return}
 const base='https://www.gstatic.com/firebasejs/12.19.0/';
 const [app,a,f]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
 api={...a,...f};const instance=app.initializeApp(firebaseConfig);auth=a.getAuth(instance);db=f.getFirestore(instance);
 a.onAuthStateChanged(auth,user=>{unsubscribe?.();unsubscribe=null;currentUser=user;onSession(user);if(user)unsubscribe=f.onSnapshot(f.collection(db,'users',user.uid,'items'),snap=>onItems(snap.docs.map(d=>({...d.data(),id:d.id}))),onError)},onError);
}
export function loginGoogle(){return api.signInWithPopup(auth,new api.GoogleAuthProvider())}
export function loginEmail(email,password){return api.signInWithEmailAndPassword(auth,email,password)}
export function registerEmail(email,password){return api.createUserWithEmailAndPassword(auth,email,password)}
export function resetPassword(email){return api.sendPasswordResetEmail(auth,email)}
export function logout(){return api.signOut(auth)}
function reference(id){if(!currentUser)throw Error('Entre na sua conta.');return api.doc(db,'users',currentUser.uid,'items',id)}
export async function putItem(item){await api.setDoc(reference(item.id),item)}
export async function removeItem(id){await api.deleteDoc(reference(id))}
export async function putItems(items){for(let start=0;start<items.length;start+=400){const batch=api.writeBatch(db);for(const item of items.slice(start,start+400))batch.set(reference(item.id),item);await batch.commit()}}
