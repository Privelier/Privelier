# Store privacy forms (founder action F22)

Answers for App Store Connect > App Privacy and Play Console > App content > Data safety, derived from `data-inventory.md`. The app ships as one binary (`com.privelier.app`, decision D18), so one set of answers covers customers and barbers. Re-check this file whenever `data-inventory.md` changes.

## App Store Connect > App Privacy

**Do you or your third-party partners collect data from this app?** Yes.

For every type below: **Linked to the user's identity: Yes. Used for tracking: No.** The only purpose to tick is **App Functionality**.

| Apple data type | Collected because |
|---|---|
| Contact Info > Name | Account; shown to the other side of a booking |
| Contact Info > Email Address | Sign-in and account email |
| Contact Info > Phone Number | Optional contact for an appointment |
| Contact Info > Physical Address | Customer's appointment address and saved addresses |
| Location > Precise Location | Barber's live position during an "On my way" trip only |
| Location > Coarse Location | Barber's offset base location shown on the map |
| User Content > Photos or Videos | Barber portfolio, ID and licence photos for verification |
| User Content > Emails or Text Messages | In-app chat messages |
| User Content > Customer Support | Reports and support requests |
| User Content > Other User Content | Reviews; SOS safety records |
| Identifiers > User ID | Account id |
| Identifiers > Device ID | Push token (Expo, APNs) |

Not collected (leave unticked): Health and Fitness, Financial Info, Sensitive Info, Contacts, Browsing History, Search History, Purchases, Usage Data, Diagnostics, Other Data.

Privacy policy URL: the published privacy notice (F20). Account deletion URL, if asked: `https://privelier.github.io/Privelier/delete-account.html`.

## Play Console > Data safety

**Overview questions**

- Does your app collect or share any of the required user data types? **Yes.**
- Is all of the user data collected by your app encrypted in transit? **Yes** (HTTPS to Supabase, Expo push, Photon, OSRM/Valhalla).
- Which account creation methods does your app support? **Username and password; OAuth (Google, Apple).**
- Do you provide a way for users to request that their data is deleted? **Yes.** Delete account URL: `https://privelier.github.io/Privelier/delete-account.html`.
- Data shared with third parties: **No.** Supabase, Expo push, APNs/FCM, Photon and the FOSSGIS routing servers process data on our behalf (service providers), which Google does not count as sharing.

**Data types** (for each: Collected yes, Shared no, Processed ephemerally no unless noted, Required or optional as noted, Purpose **App functionality**; add **Account management** where noted)

| Play category > type | Required? | Extra purpose / note |
|---|---|---|
| Location > Approximate location | Optional (barbers only) | Barber's offset base location |
| Location > Precise location | Optional (barbers only) | Live trip position; cleared when the trip ends |
| Personal info > Name | Required | Account management |
| Personal info > Email address | Required | Account management |
| Personal info > User IDs | Required | Account management |
| Personal info > Address | Optional (customers) | Appointment address |
| Personal info > Phone number | Optional | |
| Photos and videos > Photos | Optional (barbers) | Portfolio and verification documents |
| Messages > Other in-app messages | Optional | Chat between customer and barber |
| App activity > Other user-generated content | Optional | Reviews, reports, SOS records |
| Device or other IDs | Required for notifications | Push token; removed on sign-out |

Not collected: Financial info, Health and fitness, Audio, Files and docs, Calendar, Contacts, Web browsing, App info and performance (no crash or analytics SDK).

## Before submitting

- Confirm the deletion page is live (`gh workflow run pages.yml` after Pages is enabled; see F19).
- The privacy policy URL must point to the published legal text (F20), not a placeholder.
