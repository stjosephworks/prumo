# Storage

## Rule

Put in `expo-secure-store` anything that **grants access if stolen**: the access and refresh tokens, and any
other token.
Put everything else in MMKV.

Do not use MMKV's own encryption.

Persist the TanStack Query cache to MMKV with a maximum age.

On logout, clear the tokens, the persisted cache, and every MMKV key holding that user's data. Leave
device preferences (theme, language) untouched.

Decide when writing each key whether it belongs to the user or to the device.

## Rationale

The criterion is *does this alone open somebody's account*. A token does. A name does not. A cached list
of orders does not: it reveals information, and revealing is not granting.

Secure storage could not hold more even if the rule wanted it to: iOS has historically refused values
above roughly 2048 bytes, so a cached profile does not fit. Expo's own documentation also warns against
relying on it as a single source of truth for irreplaceable data.

MMKV's encryption is not used because its key has to live somewhere. Embedded in the bundle it is public;
in secure storage, the secure store is being used anyway with one more step. The app sandbox already keeps
other applications out of MMKV; its encryption defends against filesystem access, a rooted device or an
extracted backup, not against the neighbouring app.

Persisting the query cache is what separates an app that opens showing yesterday's list while it refreshes
from one that opens blank with a spinner, which is what happens every time somebody opens it in a lift. A
maximum age exists because a cache without one presents months-old data as current with no way for the
user to tell.

That persistence is also why logout must clear more than the tokens: switching users on one device would
otherwise show the previous user's data. Wiping MMKV wholesale instead would take theme and language with
it, so the same person returning finds the app as if it were new; security that punishes the common case
gets switched off by somebody.

## Applies to

Every write to persistent storage, and the logout path.

## Examples

Choosing a store:

```
✅  SecureStore: the access and refresh tokens
    MMKV:        theme, last opened tab, cached responses
❌  MMKV:        the session token        // works perfectly, protects nothing
```

Opening MMKV (version 4):

```
✅  const storage = createMMKV({ id: 'app' });  storage.remove(key)
❌  const storage = new MMKV();                  storage.delete(key)     // the version 3 API
```

Logout:

```
✅  clear tokens + query cache + user-scoped MMKV keys, kept as one list the logout walks
❌  clear tokens only
❌  MMKV.clearAll()          // takes theme and language too
```

## Enforcement

**Review only, and one line carries the weight:** that nothing granting access was written to MMKV.
Nothing breaks if it is: the app works exactly the same, which is what makes it the mistake worth
naming.

**Two facts worth knowing rather than discovering:**

**On iOS, secure-store data survives uninstalling and reinstalling the app** with the same bundle ID.
*Deleting the app to sign out* does not work, and a handed-on device stays signed in. Android deletes it
on uninstall.

**Clearing on logout does not address a lost device.** Nobody signs out of a phone that is gone:
invalidating the session remotely is server-side work, and wiping local storage is not the answer to
theft.
