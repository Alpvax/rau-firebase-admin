import * as functions from "firebase-functions";
import * as md5 from "md5";
//import * as admin from "firebase-admin";

/*interface User {
  id: string;
  name: string;
  //favouriteRune?: Rune;
  avatar: string;
}*/

type GravitarParams = {
  s?: string | number; // Size
  d?: "404" | "mp" | "identicon" | "monsterid" | "wavatar" | "retro" | "robohash" | "blank"; // Or URL: default
  f?: "y"; // Force default
  r?: "g" | "pg" | "r" | "x"; // Rating
}

function gravitarAvatar(userEmail?: string, params?: GravitarParams): string {
  params = Object.assign({
    s: 40,
    r: "pg",
    d: userEmail ? "robohash" : "mp",
  }, params);
  let hash = userEmail ? md5(userEmail.trim().toLowerCase()) : "";
  if (!hash) {
    params.f = "y";
  }
  return "https://www.gravatar.com/avatar/" + hash + "?" +
    Object.entries(params).map((p: [string, any]) => p[0] + "=" + p[1]).join("&");
}

export const getGravitarForEmail = functions.https.onRequest(async (request, response) => {
  function getQueryParam<T>(...names: string[]): string | undefined {
    for (let n of names) {
      let p = request.query[n];
      if (p !== undefined) {
        return p as string;
      }
    }
    return undefined;
  }
  let pass = getQueryParam("p", "password");
  if (!pass) {
    response.send("ERROR! No password supplied (supply it with the query parameter 'p=<password>').");
    return;
  }
  if (md5(pass) !== "b6ea2bf1401b5c9524f5b026e2308f9e") {
    response.send("ERROR! Incorrect password supplied.");
    return;
  }
  let email = getQueryParam("e", "email");
  if (!email) {
    response.send("ERROR! No email supplied (supply it with the query parameter 'email=<email address>').");
    return;
  }
  let params: GravitarParams = {};
  let s = getQueryParam("s", "size"); if (s) params.s = s;
  let d = getQueryParam("d", "default"); if (d) params.d = d as GravitarParams["d"];
  let r = getQueryParam("r", "rating"); if (r) params.r = r as GravitarParams["r"];
  response.redirect(gravitarAvatar(email, params));
});

/*export const addUser = functions.auth.user().onCreate((user, context) => {
  user.uid
  let storeUser: User = {
    id: user.uid,
    name: user.displayName || user.uid,
    avatar: user.photoURL || gravitarAvatar(user.email),
  }
  //TODO: Add to Firestore
});*/
