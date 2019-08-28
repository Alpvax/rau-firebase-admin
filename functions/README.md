# Firebase functions

##### Endpoint:
https://us-central1-firebase-rau.cloudfunctions.net/

### /runes
Retrieves Rune info from firebase RTDB and firestore.
If runes are missing from firestore, it will copy them from the RTDB.

Query args:
	rune	Comma seperated filter of rune names (without spaces).
	type	Comma seperated filter of categories (without spaces).
	sync	Force syncronization of runes from RTDB to Firestore.
		Will overwrite any existing data in the Firestore.

