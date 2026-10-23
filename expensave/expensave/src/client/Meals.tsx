import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  MenuItem,
  TextField,
} from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import RestaurantRounded from "@mui/icons-material/RestaurantRounded";
import type { Meal } from "../server/store";

export function Meals({
  meals,
  save,
  remove,
}: {
  meals: Meal[];
  save: (meal: Omit<Meal, "id">, id?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Meal | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Meal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [budget, setBudget] = useState("");
  const [servings, setServings] = useState(1);
  const money = (n: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(n / 100);
  const shown = meals.filter(
    (m) =>
      `${m.name} ${m.ingredients}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (budget === "" || m.cost * servings <= Number(budget) * 100),
  );
  const open = (meal: Meal | null) => {
    setError("");
    setEditing(meal);
  };
  return (
    <>
      <div className="meal-banner">
        <div>
          <h2>
            Your meals.
            <br />
            Your kind of everyday.
          </h2>
          <p>Keep the food you love and the costs that work for you.</p>
        </div>
        <div className="meal-illustration">
          <RestaurantRounded />
        </div>
      </div>
      <div className="section-title meal-collection-heading">
        <div>
          <h2>Your meal collection</h2>
          <p>
            {meals.length
              ? `${meals.length} meals saved by you.`
              : "A fresh page for your own food."}
          </p>
        </div>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => open(null)}
        >
          Add meal
        </Button>
      </div>
      {!!meals.length && (
        <section className="surface">
          <div className="filter-row meal-filters">
            <TextField
              label="Search your meals"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <TextField
              label="Meal budget (₱)"
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              inputProps={{ min: 0, step: 0.01 }}
            />
            <TextField
              label="Servings"
              type="number"
              value={servings}
              onChange={(e) =>
                setServings(
                  Math.max(
                    1,
                    Math.min(20, Math.floor(Number(e.target.value) || 1)),
                  ),
                )
              }
              inputProps={{ min: 1, max: 20, step: 1 }}
            />
          </div>
        </section>
      )}
      {!meals.length ? (
        <div className="surface empty">
          <RestaurantRounded />
          <h3>Your menu starts here</h3>
          <p>
            Add your own meals, ingredients, and costs. Nothing is added for
            you.
          </p>
          <Button onClick={() => open(null)}>Create your first meal</Button>
        </div>
      ) : (
        <div className="recipe-grid">
          {shown.map((meal) => (
            <article className="recipe-card personal-meal" key={meal.id}>
              <button
                className="meal-open"
                onClick={() => open(meal)}
                aria-label={`Edit ${meal.name} meal`}
              >
                <span className="recipe-art">
                  <RestaurantRounded />
                  <span>{meal.time} min</span>
                </span>
                <span className="recipe-body">
                  <span className="recipe-tag">
                    {meal.tag === "Any" ? "Your recipe" : meal.tag}
                  </span>
                  <h2>{meal.name}</h2>
                  <p>{meal.ingredients || "Add your ingredients."}</p>
                  <strong>
                    {money(meal.cost * servings)}{" "}
                    <small>
                      for {servings} serving{servings === 1 ? "" : "s"}
                    </small>
                  </strong>
                  <span className="meal-edit-hint">Edit meal →</span>
                </span>
              </button>
              <IconButton
                className="meal-delete"
                aria-label={`Delete ${meal.name} meal`}
                onClick={() => {
                  setError("");
                  setDeleting(meal);
                }}
              >
                <DeleteOutlineRounded />
              </IconButton>
            </article>
          ))}
        </div>
      )}
      {!!meals.length && !shown.length && (
        <div className="surface empty">
          <h3>No meals match yet</h3>
          <p>Try another search or adjust your budget.</p>
        </div>
      )}
      <Dialog
        open={editing !== undefined}
        onClose={() => !busy && setEditing(undefined)}
        maxWidth="sm"
        fullWidth
        aria-labelledby="meal-editor-title"
      >
        <form
          key={editing?.id || "new"}
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              const raw = String(f.get("cost") || "");
              if (!/^\d+(\.\d{1,2})?$/.test(raw))
                throw new Error(
                  "Use a cost of zero or more with up to two decimal places.",
                );
              await save(
                {
                  name: String(f.get("name")).trim(),
                  cost: Math.round(Number(raw) * 100),
                  time: Number(f.get("time")),
                  tag: String(f.get("tag")) as Meal["tag"],
                  ingredients: String(f.get("ingredients") || ""),
                  steps: String(f.get("steps") || ""),
                },
                editing?.id,
              );
              setEditing(undefined);
            } catch (cause) {
              setError((cause as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <DialogTitle className="dialog-heading" id="meal-editor-title">
            {editing ? "Edit meal" : "Add a meal"}
            <IconButton
              aria-label="Close meal editor"
              disabled={busy}
              onClick={() => setEditing(undefined)}
            >
              <CloseRounded />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <div className="form-stack editor-fields">
              <TextField
                label="Meal name"
                name="name"
                required
                autoFocus
                defaultValue={editing?.name || ""}
                inputProps={{ maxLength: 80 }}
                disabled={busy}
              />
              <div className="form-pair">
                <TextField
                  label="Cost per serving (₱)"
                  name="cost"
                  type="number"
                  required
                  defaultValue={editing ? editing.cost / 100 : ""}
                  inputProps={{ min: 0, max: 100000000, step: 0.01 }}
                  disabled={busy}
                />
                <TextField
                  label="Preparation time (minutes)"
                  name="time"
                  type="number"
                  required
                  defaultValue={editing?.time || 0}
                  inputProps={{ min: 0, max: 1440, step: 1 }}
                  disabled={busy}
                />
              </div>
              <TextField
                label="Preference"
                name="tag"
                select
                defaultValue={editing?.tag || "Any"}
                disabled={busy}
              >
                {["Any", "Plant-based", "Vegetarian", "Fish", "Meat"].map(
                  (tag) => (
                    <MenuItem key={tag} value={tag}>
                      {tag}
                    </MenuItem>
                  ),
                )}
              </TextField>
              <TextField
                label="Ingredients (optional)"
                name="ingredients"
                multiline
                minRows={2}
                defaultValue={editing?.ingredients || ""}
                inputProps={{ maxLength: 2000 }}
                disabled={busy}
              />
              <TextField
                label="How to make it (optional)"
                name="steps"
                multiline
                minRows={3}
                defaultValue={editing?.steps || ""}
                inputProps={{ maxLength: 10000 }}
                disabled={busy}
              />
              {error && <Alert severity="error">{error}</Alert>}
            </div>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button disabled={busy} onClick={() => setEditing(undefined)}>
              Cancel
            </Button>
            <Button variant="contained" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save meal"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
      <Dialog
        open={!!deleting}
        onClose={() => !busy && setDeleting(null)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="delete-meal-title"
      >
        <DialogTitle className="dialog-heading" id="delete-meal-title">
          Delete meal?
          <IconButton
            aria-label="Close delete meal"
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            <CloseRounded />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <p>Remove {deleting?.name} from your collection?</p>
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            color="error"
            disabled={busy}
            onClick={async () => {
              if (!deleting || busy) return;
              setBusy(true);
              setError("");
              try {
                await remove(deleting.id);
                setDeleting(null);
              } catch (cause) {
                setError((cause as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete meal
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
