# Your BloodFlow website: start here

You do not need to install software on your computer. You will create the account that owns the shared database. Keep its password private. The website and SQL files are already written.

## 1. Create the database account

1. Open https://supabase.com/ in your browser and choose **Start your project** or **Sign up**.
2. Sign up with your own email or GitHub account. Complete any verification Supabase asks for.
3. Create an organisation, then a new project named **BloodFlow**. Choose the Free plan if offered and a region near you.
4. Choose a strong database password and keep it in your password manager. Do not send it in chat. Wait until the project is running.

You can stop here and tell your assistant: **“My BloodFlow Supabase project is ready.”** The remaining instructions are included so the complete project can be handed over.

## 2. Create the tables and rules

1. In your Supabase project, open **SQL Editor** and start a new query.
2. Open `database/001_schema.sql` from the project package. Copy its entire contents, paste into the editor, and click **Run**.
3. Wait for success. This script is designed for a fresh project and should run once. If there is an error, share the error text rather than repeatedly running it or dropping tables.
4. In another new query, paste and run `database/002_demo_data.sql` once. This creates fictional donors and sample blood units.

Do not skip the first script: the interface alone does not enforce permissions or prevent double reservation.

## 3. Configure authentication

Dashboard names can change; look under Authentication configuration for these settings:

1. Enable email/password authentication. For this closed demo, disable public user sign-up; administrators create accounts. Do not configure open public registration for this prototype.
2. Set minimum password length to **8**. Select the password-strength option requiring **lowercase, uppercase, digits and symbols**. This must be set in Supabase Auth, as well as checked in the website. If your provider UI does not offer that policy, stop and report it; do not describe the policy as enforced.
3. Retain Supabase's authentication rate limits for repeated failed login attempts. Do not disable them.
4. For the demo, create users using **Authentication → Users → Add user → Create user** (not an email invitation). Use fictional demonstration account details and strong passwords. Use the dashboard's automatic confirmation option for these administrator-created email demo accounts so no outbound email is needed. Do not use real patient details.
5. Create your own administrator app account, one staff app account and one requester app account. Creating an application user is separate from granting access to the Supabase project dashboard.
6. Copy your administrator app user's UUID from the Users list. In SQL Editor run the following, replacing only the UUID:

```sql
update public.profiles
set display_name = 'Raju Repalle', role = 'admin'
where user_id = 'PASTE-YOUR-APP-USER-UUID-HERE';
```

7. Sign into BloodFlow using that app account. On **Accounts**, assign the second user the Staff role; leave the third as Requester. You cannot change your own role from the app.

The profile trigger always assigns new accounts the lowest privilege role. No password is stored in the app's own database tables.

### Optional mobile number login

Email login is the easiest first check. The website also accepts international-format phone identifiers (for example, `+91…`), but **do not create a separate user for the same person's phone**.

Enable phone/password auth in Supabase if needed. A provider-admin operation must attach and confirm the demo phone identifier to the existing canonical user; verify that both login routes return exactly the same UUID. This may require the provider Admin API rather than the dashboard. Ask your assistant for help with that step. A deliberately confirmed fictional demo phone is an **identifier only**, not proof of ownership. Do not claim that SMS or phone verification is free. Public use requires ownership verification and recovery providers.

Do not use SMS OTP, invitation delivery, or password-recovery emails as part of a zero-message demo. If a demo user loses their password, the project owner resets it through the provider's supported admin tools. Public registration/recovery needs separate delivery configuration.

## 4. Connect the website

1. In Supabase, find **Project settings → API / API keys**, or the project's **Connect** panel.
2. Copy the **Project URL** and **publishable key** (or the older public `anon` key).
3. At the BloodFlow login screen, expand **Connect a Supabase project**, paste those two public values and save.
4. Sign in with the app account created in step 3.

**Never enter the database password, a `service_role` key, or an `sb_secret_…` key into the website or chat.** The publishable/anon key is intentionally usable in the browser; row policies provide the access protection.

The connection form saves public settings in that browser. Another computer must enter the same project settings unless they have been included in the deployment build. For a preconfigured deployment, your assistant can rebuild using only the public URL and publishable key. No secret key is needed to build or host the frontend.

If network restrictions in a development cloud block your project, add the exact hostname `YOUR-PROJECT.supabase.co` in that environment's network settings. Do not turn off TLS verification.

## 5. Put the website online

1. Create/sign into your own Cloudflare account at https://dash.cloudflare.com/.
2. Go to **Workers & Pages**, create a **Pages** project, and choose the direct-upload / upload-assets route. Choose Pages, rather than a Worker requiring application server code.
3. Upload the **contents of `dist/`** from the hosting package. `index.html` must be at the root, with the `assets/` folder next to it.
4. Deploy using the provided `pages.dev` address. You do not need to buy a domain.
5. Set your deployed HTTPS address as the Supabase Auth Site URL and in allowed redirect URLs where relevant.
6. Visit the website, connect the database if the build was not preconfigured, and sign in. Share the website address with your classmate, along with a separate app account. Both must use the same Supabase project.

If Cloudflare offers different deployment screens or settings, share a description or screenshot with your assistant. Do not post account passwords.

## 6. Demonstrate your project

Follow `docs/ACCEPTANCE.md` using fictional records. Confirm the database is running before class; free projects can pause when inactive. Keep the source package, SQL and screenshots as a backup.

**Sample workspace** is useful to learn the screens, but its changes disappear on refresh and do not reach another computer. Only the connected database mode demonstrates shared persistence and real login.
