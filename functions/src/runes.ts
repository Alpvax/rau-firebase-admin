import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const firestore = admin.firestore();
const rtdb = admin.database();

interface Rune {
  name: string;
  codepoint: number;
  category: "letters" | "numbers" | "other";
  hasPillaredVersion: boolean;
  index: number;
  latinInput?: string;
}

function pickSet<T, K extends keyof T>(obj: T, ...keys: K[]): Partial<Pick<T, K>> {
  let o: any = {};
  keys.forEach((key) => {
    if (obj[key] !== undefined) {
      o[key] = obj[key];
    }
  });
  return o;
}

async function getRuneFromDB(ref: admin.database.Reference) {
  let snap = await ref.once("value");
  let rune = snap.val();
  let r: Rune = {
    name: ref.key!,
    codepoint: rune.codePoint,
    category: rune.category,
    hasPillaredVersion: !!rune.pillared,
    index: rune.index,
  };
  if (rune.latin) {
    r.latinInput = rune.latin;
  }
  return r;
}

async function getRuneFromFS(ref: admin.firestore.DocumentReference) {
  let snap = await ref.get();
  if (snap.exists) {
    let rune = snap.data()!;
    let r: Rune = {
      name: ref.id!,
      codepoint: rune.codepoint,
      category: rune.category,
      hasPillaredVersion: !!rune.hasPillaredVersion,
      index: -1,//rune.index,
    };
    if (rune.latinInput) {
      r.latinInput = rune.latinInput;
    }
    return r;
  } else {
    return null;
  }
}

async function addRuneToFS(rune: Rune) {
  let runeDoc = firestore.doc("runes/" + rune.name);
  let catDoc = firestore.doc("runecategories/" + rune.category);
  await Promise.all([
    runeDoc.set(pickSet(rune, "name", "codepoint", "category", "hasPillaredVersion", "latinInput")),
    catDoc.update(new admin.firestore.FieldPath("runes", rune.index.toString()), runeDoc),
  ]);
  return runeDoc;
}

type RuneDataResult = {
  name: string;
  addedToFireStore: boolean;
  rtdb: Rune;
  firestore: Rune;
}

async function getRuneData(name: string, forceSync?: boolean): Promise<RuneDataResult> {
  let dbRune = await getRuneFromDB(rtdb.ref("runes/" + name));
  let fsRune = forceSync ? null : await getRuneFromFS(firestore.doc("runes/" + name));// Skip getting existing if force sync
  let addedToFireStore = false;
  if (!fsRune) {
    fsRune = await getRuneFromFS(await addRuneToFS(dbRune));
    addedToFireStore = true;
  }
  return { name, addedToFireStore, rtdb: dbRune, firestore: fsRune! };
}

export const runes = functions.https.onRequest(async (request, response) => {
  const forceSync = !!request.query["sync"];
  let categories = new Set((request.query["type"] as string || "*").split(","));
  if (categories.has("*")) {
    categories.clear();
    (await firestore.collection("runecategories").listDocuments()).forEach((doc) => {
      categories.add(doc.id);
    });
  }
  let names = new Set((request.query["rune"] as string || "*").split(","));
  let nameArr: string[] = [];
  if (names.has("*")) {
    (await rtdb.ref("runes").once("value")).forEach((snap) => {
      if (categories.has(snap.child("category").val())) {
        nameArr.push(snap.key!);
      }
    });
  } else {
    nameArr = (await Promise.all([...names].map(async (name): Promise<[string, boolean]> => {
      let cat = await rtdb.ref("runes").child(name).child("category").once("value");
      return [name, categories.has(cat.val())];
    }))).filter(([n, f]) => f).map(([n, f]) => n);
  }
  let collector: {
    addedToFireStore: string[];
    runes: {
      [k: string]: {
        rtdb: Rune;
        firestore: Rune;
      };
    };
    filters?: {
      rune?: string[];
      type?: string[];
      result?: string[];
    };
  } = Object.assign(Object.create(null), {
    addedToFireStore: [],
    runes: {},
    filters: {
      rune: [...names],
      type: [...categories],
      result: nameArr,
    },
  });
  try {
    let results = await Promise.all(nameArr.map(n => getRuneData(n, forceSync)));
    results.reduce((collector, { name, addedToFireStore, rtdb, firestore }) => {
      if (addedToFireStore) {
        collector.addedToFireStore.push(name);
      }
      collector.runes[name] = { rtdb, firestore };
      return collector;
    }, collector);
    response.send(collector);
  } catch(e) {
    response.send({ ...collector, error: { stack: e.stack, msg: e.msg, name: e.name }});
  }
});
