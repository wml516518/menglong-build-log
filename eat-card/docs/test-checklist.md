# Test Checklist

## Mini Program

- Home loads tags.
- Draw with no filters returns a recipe.
- Draw with budget filter returns a recipe within budget.
- Draw with strict filters shows empty state.
- Detail page shows ingredients, steps, and tips.
- Favorite persists after app restart.
- Unfavorite removes a recipe.
- Favorites empty state is visible.
- Share opens a usable detail page.
- API failure shows retry UI.

## API

- Random recipe returns only published recipes.
- Random recipe respects budget.
- Random recipe respects cook time.
- Random recipe respects tags.
- Detail returns 404 for missing recipe.
- Tags are sorted by type and sort order.
- Admin create rejects missing title.
- Admin status rejects invalid token.

## Admin

- Admin can create a draft recipe.
- Admin can edit a recipe.
- Admin can publish a recipe.
- Admin can return a recipe to draft.
- Validation errors are visible.
