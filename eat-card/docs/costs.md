# Cost Triggers

The MVP should be developed with free-tier resources where possible. Free tiers can change, so verify provider dashboards before production use.

## Supabase

Used for PostgreSQL only.

Stop before paying if:

- Database size exceeds the free plan.
- API traffic or bandwidth exceeds the free plan.
- More projects or production features are needed.
- Supabase Auth or Storage is added.

## Netlify

Used for static admin UI.

Stop before paying if:

- Build minutes exceed the free plan.
- Bandwidth exceeds the free plan.
- Team features, advanced deploy controls, or paid add-ons are needed.

## Render

Used for the API backend.

Stop before paying if:

- The free instance sleep behavior is not acceptable and an always-on instance is needed.
- API traffic, bandwidth, or compute time exceeds the free plan.
- Background jobs, private services, or paid regions are added.

## DeepSeek

Used for optional AI meal generation through the Render API only.

Stop before paying or increasing quota if:

- The free trial or prepaid balance is exhausted.
- Token usage grows beyond the amount you are comfortable spending.
- Public release enables heavy repeated generation without rate limiting.
- The API key would need to be exposed outside Render environment variables.

## Domain, DNS, ICP, and Certificates

Stop before paying if:

- A Netlify domain, custom domain registration, or paid DNS provider is needed.
- ICP filing, commercial certificates, or managed certificate features are required.
- Automatic HTTPS is not enough for the selected deployment or WeChat requirements.

## WeChat Mini Program

Used for native mini program preview, upload, and release.

Stop before paying if:

- WeChat verification is required.
- WeChat Pay is added.
- A selected service category requires extra qualification.
- A custom domain, ICP filing, or business certificate is required.

## Future Paid Features

Do not add these without a separate review:

- Image upload or recipe photos.
- Paid recipe packs.
- WeChat Pay.
- Cloud user accounts.
- Advanced analytics.
