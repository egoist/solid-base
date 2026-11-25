import { createSignal, flush, Show } from "solid-js";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "..";
import { CheckboxGroup } from "../../checkbox-group";
import { Field } from "../../field";
import { Form } from "../../form";

function click(element: Element) {
  fireEvent.click(element);
  flush();
  flush();
}

function focus(element: Element) {
  fireEvent.focus(element);
  flush();
}

function blur(element: Element) {
  fireEvent.blur(element);
  flush();
}

function setup() {
  return userEvent.setup();
}

function getHiddenInput() {
  return document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
}

describe("<Checkbox.Root />", () => {
  describe("conformance", () => {
    it("renders a span and supports class, style, ref and render", () => {
      let ref: HTMLElement | undefined;
      render(() => (
        <Checkbox.Root
          data-testid="root"
          defaultChecked
          class={(state) => (state.checked ? "is-checked" : "is-unchecked")}
          style={{ color: "red" }}
          ref={(element) => {
            ref = element;
          }}
        />
      ));
      const root = screen.getByTestId("root");
      expect(root.tagName).toBe("SPAN");
      expect(ref).toBe(root);
      expect(root).toHaveClass("is-checked");
      expect(root).toHaveStyle({ color: "rgb(255, 0, 0)" });
    });

    it("supports the render prop", () => {
      render(() => (
        <Checkbox.Root
          data-testid="root"
          render={(props, state) => (
            <em {...props} data-state-checked={String(state.checked)} />
          )}
        />
      ));
      const root = screen.getByTestId("root");
      expect(root.tagName).toBe("EM");
      expect(root).toHaveAttribute("data-state-checked", "false");
    });
  });

  // Skipped: hiddenInputSizeTests (they need layout; upstream skips them in JSDOM too).

  describe("ARIA attributes", () => {
    it("sets the correct aria attributes", () => {
      const [required, setRequired] = createSignal(false);
      render(() => <Checkbox.Root data-testid="test" required={required()} />);

      expect(screen.getByRole("checkbox")).toBe(screen.getByTestId("test"));
      expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked");
      setRequired(true);
      flush();
      expect(screen.getByRole("checkbox")).toHaveAttribute(
        "aria-required",
        "true",
      );
    });
  });

  describe("extra props", () => {
    it("can override the built-in attributes", () => {
      const { container } = render(() => <Checkbox.Root role="switch" />);
      expect(container.firstElementChild as HTMLElement).toHaveAttribute(
        "role",
        "switch",
      );
    });
  });

  describe("id", () => {
    function getLabelControl(nativeButton: boolean) {
      return nativeButton ? screen.getByRole("checkbox") : getHiddenInput();
    }

    it.each([false, true])(
      "drops an explicit id when the prop is removed (nativeButton=%s)",
      (nativeButton) => {
        const [checkboxId, setCheckboxId] = createSignal<string | undefined>(
          "explicit",
        );
        render(() => (
          <Field.Root>
            <Field.Label data-testid="label">Label</Field.Label>
            <Checkbox.Root
              id={checkboxId()}
              nativeButton={nativeButton}
              render={nativeButton ? "button" : undefined}
            />
          </Field.Root>
        ));

        const label = screen.getByTestId("label");
        expect(getLabelControl(nativeButton)).toHaveAttribute("id", "explicit");
        expect(label).toHaveAttribute("for", "explicit");

        setCheckboxId(undefined);
        flush();

        const control = getLabelControl(nativeButton);
        expect(control.id).not.toBe("");
        expect(control).not.toHaveAttribute("id", "explicit");
        expect(label).toHaveAttribute("for", control.id);
      },
    );

    it.each([false, true])(
      "does not reuse an unmounted Checkbox id for a keyed id-less Checkbox (nativeButton=%s)",
      (nativeButton) => {
        const [swapped, setSwapped] = createSignal(false);
        render(() => (
          <Field.Root>
            <Field.Label data-testid="label">Label</Field.Label>
            <Show
              when={swapped()}
              fallback={
                <Checkbox.Root
                  id="explicit"
                  nativeButton={nativeButton}
                  render={nativeButton ? "button" : undefined}
                />
              }
            >
              <Checkbox.Root
                nativeButton={nativeButton}
                render={nativeButton ? "button" : undefined}
              />
            </Show>
          </Field.Root>
        ));

        const label = screen.getByTestId("label");
        expect(getLabelControl(nativeButton)).toHaveAttribute("id", "explicit");
        expect(label).toHaveAttribute("for", "explicit");

        setSwapped(true);
        flush();

        const control = getLabelControl(nativeButton);
        expect(control.id).not.toBe("");
        expect(control).not.toHaveAttribute("id", "explicit");
        expect(label).toHaveAttribute("for", control.id);
      },
    );

    // Skipped: 'defers an explicit id until hydration but keeps Field.Label associated during SSR'
    // (SSR/hydration is not covered by these jsdom tests).
  });

  describe("prop: onClick", () => {
    it.each([false, true])(
      "propagates a single click event to ancestors per user click (nativeButton=%s)",
      (nativeButton) => {
        const handleParentClick = vi.fn();
        render(() => (
          <div onClick={handleParentClick}>
            <Checkbox.Root
              nativeButton={nativeButton}
              render={nativeButton ? "button" : undefined}
              data-testid="checkbox"
            />
          </div>
        ));

        click(screen.getByTestId("checkbox"));

        expect(handleParentClick).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("checkbox")).toHaveAttribute(
          "aria-checked",
          "true",
        );
      },
    );

    it.each([false, true])(
      "does not propagate to ancestors when stopPropagation() is called (nativeButton=%s)",
      (nativeButton) => {
        const handleParentClick = vi.fn();
        render(() => (
          <div onClick={handleParentClick}>
            <Checkbox.Root
              nativeButton={nativeButton}
              render={nativeButton ? "button" : undefined}
              data-testid="checkbox"
              onClick={(event: MouseEvent) => event.stopPropagation()}
            />
          </div>
        ));

        click(screen.getByTestId("checkbox"));

        expect(handleParentClick).toHaveBeenCalledTimes(0);
        expect(screen.getByTestId("checkbox")).toHaveAttribute(
          "aria-checked",
          "true",
        );
      },
    );
  });

  describe("interactions", () => {
    it("tolerates imperative interaction in its ref callback before the hidden input mounts", () => {
      render(() => (
        <Checkbox.Root
          ref={(element) => {
            if (element) {
              element.focus();
              element.blur();
              element.click();
            }
          }}
        />
      ));
      flush();

      expect(screen.getByRole("checkbox")).toHaveAttribute(
        "aria-checked",
        "false",
      );
    });

    it("should change its state when clicked", () => {
      render(() => <Checkbox.Root />);
      const [checkbox] = screen.getAllByRole("checkbox");
      // querying it separately since hidden true returns both button and input.
      // without hidden it only returns the button (in the above query)
      const [, input] = screen.getAllByRole<HTMLInputElement>("checkbox", {
        hidden: true,
      });

      expect(checkbox).toHaveAttribute("aria-checked", "false");
      expect(input.checked).toBe(false);

      checkbox.click();
      flush();

      expect(checkbox).toHaveAttribute("aria-checked", "true");
      expect(input.checked).toBe(true);

      checkbox.click();
      flush();

      expect(checkbox).toHaveAttribute("aria-checked", "false");
      expect(input.checked).toBe(false);
    });

    it("should update its state when changed from outside", () => {
      const [checked, setChecked] = createSignal(false);
      render(() => (
        <div>
          <button onClick={() => setChecked((c) => !c)}>Toggle</button>
          <Checkbox.Root checked={checked()} />
        </div>
      ));
      const [checkbox] = screen.getAllByRole("checkbox");
      const button = screen.getByText("Toggle");

      expect(checkbox).toHaveAttribute("aria-checked", "false");
      button.click();
      flush();

      expect(checkbox).toHaveAttribute("aria-checked", "true");

      button.click();
      flush();

      expect(checkbox).toHaveAttribute("aria-checked", "false");
    });

    it("should call onCheckedChange when clicked", () => {
      const handleChange = vi.fn();
      render(() => <Checkbox.Root onCheckedChange={handleChange} />);
      const [checkbox] = screen.getAllByRole("checkbox");

      checkbox.click();
      flush();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(true);
    });

    it("does not update its state when onCheckedChange cancels the event", () => {
      const handleChange = vi.fn(
        (_: boolean, eventDetails: Checkbox.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );

      render(() => <Checkbox.Root onCheckedChange={handleChange} />);
      const checkbox = screen.getByRole("checkbox");
      const [, input] = screen.getAllByRole<HTMLInputElement>("checkbox", {
        hidden: true,
      });

      click(checkbox);

      expect(handleChange.mock.calls.length).toBe(1);
      expect(checkbox).toHaveAttribute("aria-checked", "false");
      expect(input.checked).toBe(false);
    });

    it("should report keyboard modifier event properties when calling onCheckedChange", async () => {
      const handleChange = vi.fn(
        (_checked: boolean, eventDetails: Checkbox.Root.ChangeEventDetails) =>
          eventDetails,
      );
      const user = setup();
      render(() => <Checkbox.Root onCheckedChange={handleChange} />);
      const [checkbox] = screen.getAllByRole("checkbox");

      await user.keyboard("{Shift>}");
      await user.click(checkbox);
      await user.keyboard("{/Shift}");

      expect(handleChange.mock.calls.length).toBe(1);
      expect(
        (handleChange.mock.results[0]?.value.event as MouseEvent).shiftKey,
      ).toBe(true);
    });

    it("should update its state if the underlying input is toggled", () => {
      render(() => <Checkbox.Root />);
      const checkbox = screen.getByRole("checkbox");
      const internalInput = getHiddenInput();

      internalInput.click();
      flush();

      expect(checkbox).toHaveAttribute("aria-checked", "true");
    });

    it("ignores a hidden input click canceled before it is handled", () => {
      const handleCheckedChange = vi.fn();
      render(() => <Checkbox.Root onCheckedChange={handleCheckedChange} />);

      const checkbox = screen.getByRole("checkbox");
      const input = screen.getAllByRole<HTMLInputElement>("checkbox", {
        hidden: true,
      })[1];
      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      event.preventDefault();

      fireEvent(input, event);
      flush();

      expect(handleCheckedChange).not.toHaveBeenCalled();
      expect(checkbox).toHaveAttribute("aria-checked", "false");
    });

    it("can be activated with Space key", async () => {
      const user = setup();
      render(() => <Checkbox.Root />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("aria-checked", "false");

      await user.keyboard("[Tab]");
      expect(checkbox).toHaveFocus();

      await user.keyboard("[Space]");
      expect(checkbox).toHaveAttribute("aria-checked", "true");
    });

    it("does not activate with Enter key", async () => {
      const user = setup();
      render(() => <Checkbox.Root />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("aria-checked", "false");

      await user.keyboard("[Tab]");
      expect(checkbox).toHaveFocus();

      await user.keyboard("[Enter]");
      expect(checkbox).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("prop: disabled", () => {
    it("uses aria-disabled instead of HTML disabled", () => {
      render(() => <Checkbox.Root disabled />);
      expect(screen.getByRole("checkbox")).not.toHaveAttribute("disabled");
      expect(screen.getByRole("checkbox")).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });

    it("should not change its state when clicked", () => {
      render(() => <Checkbox.Root disabled />);
      const [checkbox] = screen.getAllByRole("checkbox");

      expect(checkbox).toHaveAttribute("aria-checked", "false");

      checkbox.click();
      flush();

      expect(checkbox).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("prop: readOnly", () => {
    it("should have the `aria-readonly` attribute", () => {
      render(() => <Checkbox.Root readOnly />);
      expect(screen.getAllByRole("checkbox")[0]).toHaveAttribute(
        "aria-readonly",
        "true",
      );
    });

    it("should not have the aria attribute when `readOnly` is not set", () => {
      render(() => <Checkbox.Root />);
      expect(screen.getAllByRole("checkbox")[0]).not.toHaveAttribute(
        "aria-readonly",
      );
    });

    it("should not change its state when clicked", () => {
      render(() => <Checkbox.Root readOnly />);
      const [checkbox] = screen.getAllByRole("checkbox");

      expect(checkbox).toHaveAttribute("aria-checked", "false");

      checkbox.click();
      flush();

      expect(checkbox).toHaveAttribute("aria-checked", "false");
    });

    it("should not change its state when its label is clicked", () => {
      render(() => (
        <label data-testid="label">
          <Checkbox.Root readOnly />
        </label>
      ));
      const [checkbox] = screen.getAllByRole("checkbox");

      expect(checkbox).toHaveAttribute("aria-checked", "false");

      screen.getByTestId("label").click();
      flush();

      expect(checkbox).toHaveAttribute("aria-checked", "false");
      expect(getHiddenInput().checked).toBe(false);
    });
  });

  describe("prop: indeterminate", () => {
    it('should set the `aria-checked` attribute as "mixed"', () => {
      render(() => <Checkbox.Root indeterminate />);
      expect(screen.getAllByRole("checkbox")[0]).toHaveAttribute(
        "aria-checked",
        "mixed",
      );
    });

    it("should not change its state when clicked", () => {
      render(() => <Checkbox.Root indeterminate />);
      const [checkbox] = screen.getAllByRole("checkbox");

      expect(checkbox).toHaveAttribute("aria-checked", "mixed");

      checkbox.click();
      flush();

      expect(checkbox).toHaveAttribute("aria-checked", "mixed");
    });

    it("should not have the aria attribute when `indeterminate` is not set", () => {
      render(() => <Checkbox.Root />);
      expect(screen.getAllByRole("checkbox")[0]).not.toHaveAttribute(
        "aria-checked",
        "mixed",
      );
    });

    it("should not be overridden by `checked` prop", () => {
      render(() => <Checkbox.Root indeterminate checked />);
      expect(screen.getAllByRole("checkbox")[0]).toHaveAttribute(
        "aria-checked",
        "mixed",
      );
    });

    it("sets the native input state when indeterminate", () => {
      render(() => <Checkbox.Root indeterminate />);

      const [, input] = screen.getAllByRole<HTMLInputElement>("checkbox", {
        hidden: true,
      });
      expect(input.indeterminate).toBe(true);
    });

    it("keeps the native input state when checked changes while indeterminate remains", () => {
      const [checked, setChecked] = createSignal(false);
      render(() => (
        <Checkbox.Root
          data-testid="button"
          indeterminate
          checked={checked()}
          onCheckedChange={setChecked}
        />
      ));

      // Clicking the hidden input natively clears `indeterminate` before toggling.
      click(screen.getByTestId("button"));

      const [, input] = screen.getAllByRole<HTMLInputElement>("checkbox", {
        hidden: true,
      });
      expect(input.checked).toBe(true);
      expect(input.indeterminate).toBe(true);
    });

    it("sets indeterminate style hooks on the root and indicator", () => {
      render(() => (
        <Checkbox.Root indeterminate>
          <Checkbox.Indicator data-testid="indicator" />
        </Checkbox.Root>
      ));

      expect(screen.getByRole("checkbox")).toHaveAttribute(
        "data-indeterminate",
        "",
      );
      expect(screen.getByTestId("indicator")).toHaveAttribute(
        "data-indeterminate",
        "",
      );
    });

    it("sets grouped parent aria when manually indeterminate", () => {
      render(() => (
        <CheckboxGroup value={[]} allValues={["one"]}>
          <Checkbox.Root parent indeterminate data-testid="parent" />
          <Checkbox.Root value="one" />
        </CheckboxGroup>
      ));

      expect(screen.getByTestId("parent")).toHaveAttribute(
        "aria-checked",
        "mixed",
      );
    });

    it("sets grouped parent native input state when manually indeterminate", () => {
      render(() => (
        <CheckboxGroup value={[]} allValues={["one"]}>
          <Checkbox.Root parent indeterminate data-testid="parent" />
          <Checkbox.Root value="one" />
        </CheckboxGroup>
      ));

      const [, input] = screen.getAllByRole<HTMLInputElement>("checkbox", {
        hidden: true,
      });
      expect(input.indeterminate).toBe(true);
    });
  });

  it("should place the style hooks on the root and the indicator", () => {
    const [interactive, setInteractive] = createSignal(false);
    render(() => (
      <Checkbox.Root
        defaultChecked
        disabled={!interactive()}
        readOnly={!interactive()}
        required
      >
        <Checkbox.Indicator />
      </Checkbox.Root>
    ));

    const [checkbox] = screen.getAllByRole("checkbox");
    const indicator = checkbox.querySelector("span");

    expect(checkbox).toHaveAttribute("data-checked", "");
    expect(checkbox).not.toHaveAttribute("data-unchecked");

    expect(checkbox).toHaveAttribute("data-disabled", "");
    expect(checkbox).toHaveAttribute("data-readonly", "");
    expect(checkbox).toHaveAttribute("data-required", "");

    expect(indicator).toHaveAttribute("data-checked", "");
    expect(indicator).not.toHaveAttribute("data-unchecked");

    expect(indicator).toHaveAttribute("data-disabled", "");
    expect(indicator).toHaveAttribute("data-readonly", "");
    expect(indicator).toHaveAttribute("data-required", "");

    setInteractive(true);
    flush();
    click(checkbox);

    expect(checkbox).toHaveAttribute("data-unchecked", "");
    expect(checkbox).not.toHaveAttribute("data-checked");
  });

  it("should set the name attribute only on the input", () => {
    render(() => <Checkbox.Root name="checkbox-name" />);

    const [, input] = screen.getAllByRole<HTMLInputElement>("checkbox", {
      hidden: true,
    });
    expect(input).toHaveAttribute("name", "checkbox-name");
    expect(screen.getByRole("checkbox")).not.toHaveAttribute("name");
  });

  describe("with native <label>", () => {
    it("should toggle the checkbox when a wrapping <label> is clicked", () => {
      render(() => (
        <label data-testid="label">
          <Checkbox.Root />
          Toggle
        </label>
      ));

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("aria-checked", "false");

      click(screen.getByTestId("label"));
      expect(checkbox).toHaveAttribute("aria-checked", "true");
    });

    it("should toggle the checkbox when a explicitly linked <label> is clicked", () => {
      render(() => (
        <div>
          <label data-testid="label" for="myCheckbox">
            Toggle
          </label>

          <Checkbox.Root id="myCheckbox" />
        </div>
      ));

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("aria-checked", "false");

      click(screen.getByTestId("label"));
      expect(checkbox).toHaveAttribute("aria-checked", "true");
    });

    it("should associate `id` with the native button when `nativeButton=true`", () => {
      render(() => (
        <div>
          <label data-testid="label" for="myCheckbox">
            Toggle
          </label>

          <Checkbox.Root id="myCheckbox" nativeButton render="button" />
        </div>
      ));

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toHaveAttribute("id", "myCheckbox");

      const hiddenInputs = screen.getAllByRole<HTMLInputElement>("checkbox", {
        hidden: true,
      });
      const hiddenInput = hiddenInputs.find((input) => input !== checkbox);
      expect(hiddenInput).not.toBe(undefined);
      expect(hiddenInput).not.toHaveAttribute("id", "myCheckbox");

      expect(checkbox).toHaveAttribute("aria-checked", "false");
      click(screen.getByTestId("label"));
      expect(checkbox).toHaveAttribute("aria-checked", "true");
    });

    it("falls back to the Field control id when id is empty", () => {
      render(() => (
        <Field.Root>
          <Field.Label>Label</Field.Label>
          <Checkbox.Root id="" />
        </Field.Root>
      ));

      const label = screen.getByText("Label");
      const input = getHiddenInput();
      const checkbox = screen.getByRole("checkbox");

      expect(input.id).not.toBe("");
      expect(label).toHaveAttribute("for", input.id);

      click(label);
      expect(checkbox).toHaveAttribute("aria-checked", "true");
    });

    it("assigns an input id to a valueless child in a parent checkbox group", () => {
      render(() => (
        <CheckboxGroup allValues={["one"]}>
          <Checkbox.Root />
        </CheckboxGroup>
      ));

      expect(getHiddenInput().id).not.toBe("");
    });

    it("assigns a root id to a valueless native button in a parent checkbox group", () => {
      render(() => (
        <CheckboxGroup allValues={["one"]}>
          <Checkbox.Root nativeButton render="button" />
        </CheckboxGroup>
      ));

      expect(screen.getByRole("checkbox").id).not.toBe("");
    });
  });

  describe("Form", () => {
    it("triggers native HTML validation on submit", async () => {
      const user = setup();
      render(() => (
        <Form>
          <Field.Root name="test" data-testid="field">
            <Checkbox.Root required />
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      const submit = screen.getByText("Submit");

      expect(screen.queryByTestId("error")).toBe(null);

      await user.click(submit);

      const error = screen.getByTestId("error");
      expect(error).toHaveTextContent("required");
    });

    it("clears external errors on change", () => {
      render(() => (
        <Form errors={{ test: "test" }}>
          <Field.Root name="test" data-testid="field">
            <Checkbox.Root data-testid="checkbox" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>
      ));

      const checkbox = screen.getByTestId("checkbox");

      expect(checkbox).toHaveAttribute("aria-invalid", "true");
      expect(screen.queryByTestId("error")).toHaveTextContent("test");

      click(checkbox);

      expect(checkbox).not.toHaveAttribute("aria-invalid");
      expect(screen.queryByTestId("error")).toBe(null);
    });

    it("submits the checked value through onFormSubmit", () => {
      const handleSubmit = vi.fn();
      render(() => (
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="test-checkbox">
            <Checkbox.Root data-testid="checkbox" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>
      ));

      click(screen.getByText("Submit"));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({
        "test-checkbox": false,
      });

      click(screen.getByTestId("checkbox"));
      click(screen.getByText("Submit"));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({
        "test-checkbox": true,
      });
    });

    it("renders the unchecked value as a hidden input while unchecked", () => {
      render(() => (
        <Checkbox.Root
          data-testid="checkbox"
          name="test-checkbox"
          uncheckedValue="off"
        />
      ));

      const hidden = () =>
        document.querySelector<HTMLInputElement>(
          'input[type="hidden"][name="test-checkbox"]',
        );

      expect(hidden()).toHaveAttribute("value", "off");

      click(screen.getByTestId("checkbox"));
      expect(hidden()).toBe(null);

      click(screen.getByTestId("checkbox"));
      expect(hidden()).toHaveAttribute("value", "off");
    });

    it("sets the value attribute only on the hidden input", () => {
      render(() => <Checkbox.Root data-testid="checkbox" value="test-value" />);

      expect(getHiddenInput()).toHaveAttribute("value", "test-value");
      expect(screen.getByTestId("checkbox")).not.toHaveAttribute("value");
    });

    // Skipped (upstream skips them in JSDOM: they rely on native form submission / FormData,
    // implicit submission with Enter and the `form` attribute): native FormData submission,
    // Enter submission (default submitter, consumer/ancestor preventDefault, readOnly, native
    // button, no submit button, disabled default button), external `form`, custom value and
    // uncheckedValue submission, and matching native checkbox submission.
  });

  describe("Field", () => {
    it("should receive disabled prop from Field.Root", () => {
      render(() => (
        <Field.Root disabled>
          <Checkbox.Root />
        </Field.Root>
      ));

      const [checkbox] = screen.getAllByRole("checkbox");
      expect(checkbox).toHaveAttribute("aria-disabled", "true");
    });

    it("should receive name prop from Field.Root", () => {
      render(() => (
        <Field.Root name="field-checkbox">
          <Checkbox.Root />
        </Field.Root>
      ));

      const [, input] = screen.getAllByRole<HTMLInputElement>("checkbox", {
        hidden: true,
      });
      expect(input).toHaveAttribute("name", "field-checkbox");
    });

    it("[data-touched]", () => {
      render(() => (
        <Field.Root>
          <Checkbox.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId("button");

      focus(button);
      blur(button);

      expect(button).toHaveAttribute("data-touched", "");
    });

    it("[data-dirty]", () => {
      render(() => (
        <Field.Root>
          <Checkbox.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId("button");

      expect(button).not.toHaveAttribute("data-dirty");

      click(button);

      expect(button).toHaveAttribute("data-dirty", "");
    });

    describe("[data-filled]", () => {
      it("adds [data-filled] attribute when checked after being initially unchecked", () => {
        render(() => (
          <Field.Root>
            <Checkbox.Root data-testid="button" />
          </Field.Root>
        ));

        const button = screen.getByTestId("button");

        expect(button).not.toHaveAttribute("data-filled");

        click(button);

        expect(button).toHaveAttribute("data-filled", "");

        click(button);

        expect(button).not.toHaveAttribute("data-filled");
      });

      it("removes [data-filled] attribute when unchecked after being initially checked", () => {
        render(() => (
          <Field.Root>
            <Checkbox.Root data-testid="button" defaultChecked />
          </Field.Root>
        ));

        const button = screen.getByTestId("button");

        expect(button).toHaveAttribute("data-filled");

        click(button);

        expect(button).not.toHaveAttribute("data-filled", "");
      });

      it("clears [data-filled] when a controlled checkbox remounts unchecked", () => {
        const [unchecked, setUnchecked] = createSignal(false);
        render(() => (
          <Field.Root data-testid="root">
            <Show
              when={unchecked()}
              fallback={<Checkbox.Root checked onCheckedChange={() => {}} />}
            >
              <Checkbox.Root checked={false} onCheckedChange={() => {}} />
            </Show>
            <button type="button" onClick={() => setUnchecked(true)}>
              clear
            </button>
          </Field.Root>
        ));

        const root = screen.getByTestId("root");
        expect(root).toHaveAttribute("data-filled", "");

        click(screen.getByText("clear"));

        expect(root).not.toHaveAttribute("data-filled");
      });

      it("adds [data-filled] attribute when any checkbox is filled when inside a group", () => {
        render(() => (
          <Field.Root>
            <CheckboxGroup defaultValue={["1", "2"]}>
              <Checkbox.Root name="1" data-testid="button-1" />
              <Checkbox.Root name="2" data-testid="button-2" />
            </CheckboxGroup>
          </Field.Root>
        ));

        const button1 = screen.getByTestId("button-1");
        const button2 = screen.getByTestId("button-2");

        expect(button1).toHaveAttribute("data-filled");
        expect(button2).toHaveAttribute("data-filled");

        click(button1);

        expect(button1).toHaveAttribute("data-filled");
        expect(button2).toHaveAttribute("data-filled");

        click(button2);

        expect(button1).not.toHaveAttribute("data-filled");
        expect(button2).not.toHaveAttribute("data-filled");
      });
    });

    it("[data-focused]", () => {
      render(() => (
        <Field.Root>
          <Checkbox.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId("button");

      expect(button).not.toHaveAttribute("data-focused");

      focus(button);

      expect(button).toHaveAttribute("data-focused", "");

      blur(button);

      expect(button).not.toHaveAttribute("data-focused");
    });

    it("does not set [data-focused] when disabled", () => {
      render(() => (
        <Field.Root>
          <Checkbox.Root disabled data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId("button");

      focus(button);

      expect(button).not.toHaveAttribute("data-focused");
    });

    describe("[data-focused] without a blur event", () => {
      it("is removed when the focused checkbox becomes disabled", () => {
        const [disabled, setDisabled] = createSignal(false);
        render(() => (
          <Field.Root data-testid="root">
            <Checkbox.Root data-testid="first" disabled={disabled()} />
          </Field.Root>
        ));

        const button = screen.getByTestId("first");
        button.focus();
        flush();

        expect(screen.getByTestId("root")).toHaveAttribute("data-focused", "");

        setDisabled(true);
        flush();

        expect(screen.getByTestId("root")).not.toHaveAttribute("data-focused");
        expect(button).not.toHaveAttribute("data-focused");
      });

      it("is removed when the focused checkbox unmounts", () => {
        const [mounted, setMounted] = createSignal(true);
        render(() => (
          <Field.Root data-testid="root">
            <Show when={mounted()}>
              <Checkbox.Root data-testid="first" />
            </Show>
          </Field.Root>
        ));

        screen.getByTestId("first").focus();
        flush();

        expect(screen.getByTestId("root")).toHaveAttribute("data-focused", "");

        setMounted(false);
        flush();

        expect(screen.getByTestId("root")).not.toHaveAttribute("data-focused");
      });

      // Skipped: 'is kept when the checkbox is focused during mount in StrictMode' (React
      // StrictMode only).
    });

    it("[data-invalid]", () => {
      render(() => (
        <Field.Root invalid>
          <Checkbox.Root data-testid="button" />
        </Field.Root>
      ));

      expect(screen.getByTestId("button")).toHaveAttribute("data-invalid", "");
    });

    it("[data-valid]", () => {
      render(() => (
        <Field.Root validationMode="onBlur">
          <Checkbox.Root data-testid="button" required />
        </Field.Root>
      ));

      const button = screen.getByTestId("button");

      expect(button).not.toHaveAttribute("data-valid");
      expect(button).not.toHaveAttribute("data-invalid");

      // Check the checkbox and trigger validation
      click(button);
      focus(button);
      blur(button);

      expect(button).toHaveAttribute("data-valid", "");
      expect(button).not.toHaveAttribute("data-invalid");
    });

    it("prop: validationMode=onSubmit", () => {
      render(() => (
        <Form>
          <Field.Root>
            <Checkbox.Root required />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>
      ));

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).not.toHaveAttribute("aria-invalid");

      click(checkbox);
      expect(checkbox).toHaveAttribute("data-checked", "");
      click(checkbox);
      expect(checkbox).toHaveAttribute("data-unchecked", "");
      expect(checkbox).not.toHaveAttribute("aria-invalid");

      click(screen.getByText("submit"));
      expect(checkbox).toHaveAttribute("aria-invalid", "true");

      click(checkbox);
      expect(checkbox).toHaveAttribute("data-checked", "");
      expect(checkbox).not.toHaveAttribute("aria-invalid");

      click(checkbox);
      expect(checkbox).toHaveAttribute("data-unchecked", "");
      expect(checkbox).toHaveAttribute("aria-invalid");

      click(checkbox);
      expect(checkbox).toHaveAttribute("data-checked", "");
      expect(checkbox).not.toHaveAttribute("aria-invalid");
    });

    it("props: validationMode=onChange", () => {
      render(() => (
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? "error" : null;
          }}
        >
          <Checkbox.Root data-testid="button" />
        </Field.Root>
      ));

      const button = screen.getByTestId("button");

      expect(button).not.toHaveAttribute("aria-invalid");

      click(button);

      expect(button).toHaveAttribute("aria-invalid", "true");
    });

    it("validates once when changed by the user", async () => {
      const validate = vi.fn();
      const user = setup();

      render(() => (
        <Field.Root validationMode="onChange" validate={validate}>
          <Checkbox.Root />
        </Field.Root>
      ));

      await user.click(screen.getByRole("checkbox"));

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe(true);
    });

    it("revalidates when a controlled value changes externally", () => {
      const validateSpy = vi.fn((value: unknown) =>
        (value as boolean) ? "error" : null,
      );
      const [checked, setChecked] = createSignal(false);

      render(() => (
        <>
          <Field.Root
            validationMode="onChange"
            validate={validateSpy}
            name="terms"
          >
            <Checkbox.Root
              data-testid="button"
              checked={checked()}
              onCheckedChange={setChecked}
            />
          </Field.Root>
          <button type="button" onClick={() => setChecked((prev) => !prev)}>
            Toggle externally
          </button>
        </>
      ));

      const button = screen.getByTestId("button");
      const toggle = screen.getByText("Toggle externally");

      expect(button).not.toHaveAttribute("aria-invalid");
      const initialCallCount = validateSpy.mock.calls.length;

      click(toggle);

      expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
      expect(validateSpy.mock.lastCall?.[0]).toBe(true);
      expect(button).toHaveAttribute("aria-invalid", "true");
    });

    it("prop: validationMode=onBlur", () => {
      render(() => (
        <Field.Root
          validationMode="onBlur"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? "error" : null;
          }}
        >
          <Checkbox.Root data-testid="button" />
          <Field.Error data-testid="error" />
        </Field.Root>
      ));

      const button = screen.getByTestId("button");

      expect(button).not.toHaveAttribute("aria-invalid");

      click(button);
      blur(button);

      expect(button).toHaveAttribute("aria-invalid", "true");
    });

    describe("Field.Label", () => {
      describe("explicit association", () => {
        it("when label and checkbox are siblings", () => {
          render(() => (
            <Field.Root>
              <Field.Label>Label</Field.Label>
              <Checkbox.Root />
            </Field.Root>
          ));

          const label = screen.getByText("Label");
          expect(label.getAttribute("id")).not.toBe(null);

          const input = getHiddenInput();
          expect(label.getAttribute("for")).toBe(input.getAttribute("id"));

          const checkbox = screen.getByRole("checkbox");
          expect(checkbox.getAttribute("aria-labelledby")).toBe(
            label.getAttribute("id"),
          );
          expect(checkbox).toHaveAttribute("aria-checked", "false");

          click(label);
          expect(checkbox).toHaveAttribute("aria-checked", "true");
        });
      });

      describe("implicit association", () => {
        it("sets `for` on the label", () => {
          render(() => (
            <Field.Root>
              <Field.Label data-testid="label">
                <Checkbox.Root />
                OK
              </Field.Label>
            </Field.Root>
          ));

          const label = screen.getByTestId("label");
          const input = getHiddenInput();
          expect(label.getAttribute("for")).not.toBe(null);
          expect(label.getAttribute("for")).toBe(input.getAttribute("id"));

          const checkbox = screen.getByRole("checkbox");
          expect(label.getAttribute("id")).not.toBe(null);
          expect(checkbox.getAttribute("aria-labelledby")).toBe(
            label.getAttribute("id"),
          );

          expect(checkbox).toHaveAttribute("aria-checked", "false");
          click(screen.getByText("OK"));
          expect(checkbox).toHaveAttribute("aria-checked", "true");
        });
      });
    });

    it("Field.Description", () => {
      render(() => (
        <Field.Root>
          <Checkbox.Root
            data-testid="button"
            aria-describedby="external-description"
          />
          <Field.Description data-testid="description" />
        </Field.Root>
      ));

      expect(screen.getByRole("checkbox")).toHaveAttribute(
        "aria-describedby",
        `external-description ${screen.getByTestId("description").id}`,
      );
    });
  });

  it("should change state when clicking the checkbox if it has a wrapping label", () => {
    render(() => (
      <label data-testid="label">
        <Checkbox.Root />
        Toggle
      </label>
    ));

    const [checkbox] = screen.getAllByRole("checkbox");

    expect(checkbox).toHaveAttribute("aria-checked", "false");

    click(checkbox);

    expect(checkbox).toHaveAttribute("aria-checked", "true");

    click(checkbox);

    expect(checkbox).toHaveAttribute("aria-checked", "false");
  });

  it("sets `aria-labelledby` from a sibling label associated with the hidden input", () => {
    render(() => (
      <div>
        <label for="checkbox-input">Label</label>
        <Checkbox.Root id="checkbox-input" />
      </div>
    ));

    const label = screen.getByText("Label");
    expect(label.id).not.toBe("");
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "aria-labelledby",
      label.id,
    );
  });

  it("updates fallback `aria-labelledby` when the hidden input id changes", async () => {
    const [id, setId] = createSignal("checkbox-input-a");
    render(() => (
      <>
        <label for="checkbox-input-a">Label A</label>
        <label for="checkbox-input-b">Label B</label>
        <Checkbox.Root id={id()} />
        <button type="button" onClick={() => setId("checkbox-input-b")}>
          Toggle
        </button>
      </>
    ));

    const checkbox = screen.getByRole("checkbox");
    const labelA = screen.getByText("Label A");

    expect(labelA.id).not.toBe("");
    expect(checkbox).toHaveAttribute("aria-labelledby", labelA.id);

    click(screen.getByRole("button", { name: "Toggle" }));

    const labelB = screen.getByText("Label B");

    await waitFor(() => {
      expect(checkbox).toHaveAttribute("aria-labelledby", labelB.id);
    });

    expect(labelB.id).not.toBe("");
    expect(labelB.id).not.toBe(labelA.id);
  });

  it("prefers `aria-label` over an associated label", () => {
    render(() => (
      <>
        <label>
          <Checkbox.Root aria-label="lease.pdf" />
          lease.pdf
        </label>
        <Field.Root>
          <Field.Label>
            <Checkbox.Root aria-label="notes.txt" />
            notes.txt
          </Field.Label>
        </Field.Root>
      </>
    ));

    const [nativeLabelled, fieldLabelled] = screen.getAllByRole("checkbox");
    expect(nativeLabelled).not.toHaveAttribute("aria-labelledby");
    expect(nativeLabelled).toHaveAccessibleName("lease.pdf");
    expect(fieldLabelled).not.toHaveAttribute("aria-labelledby");
    expect(fieldLabelled).toHaveAccessibleName("notes.txt");
  });

  // Deviation: a render callback is opaque in this port (it only receives the props), so a
  // callback adding its own `aria-label` is expected to drop the `aria-labelledby` it receives
  // (see `resolveRenderedAriaLabel`).
  it("prefers a render element's `aria-label` over an associated label", () => {
    render(() => (
      <>
        <label>
          <Checkbox.Root
            render={(props) => (
              <span
                {...props}
                aria-label="lease.pdf"
                aria-labelledby={undefined}
              />
            )}
          />
          lease.pdf
        </label>
        <Field.Root>
          <Field.Label>
            <Checkbox.Root
              render={(props) => (
                <span
                  {...props}
                  aria-label="notes.txt"
                  aria-labelledby={undefined}
                />
              )}
            />
            notes.txt
          </Field.Label>
        </Field.Root>
      </>
    ));

    const [nativeLabelled, fieldLabelled] = screen.getAllByRole("checkbox");
    expect(nativeLabelled).not.toHaveAttribute("aria-labelledby");
    expect(nativeLabelled).toHaveAccessibleName("lease.pdf");
    expect(fieldLabelled).not.toHaveAttribute("aria-labelledby");
    expect(fieldLabelled).toHaveAccessibleName("notes.txt");
  });

  it.each(["", " ", "\n\t "])(
    "ignores a blank `aria-label` (%j)",
    (ariaLabel) => {
      render(() => (
        <>
          <label>
            <Checkbox.Root aria-label={ariaLabel} />
            Native label
          </label>
          <Field.Root>
            <Field.Label>
              <Checkbox.Root aria-label={ariaLabel} />
              Field label
            </Field.Label>
          </Field.Root>
          <label for="blank-aria-label">Sibling label</label>
          <Checkbox.Root id="blank-aria-label" aria-label={ariaLabel} />
        </>
      ));

      const [nativeLabelled, fieldLabelled, siblingLabelled] =
        screen.getAllByRole("checkbox");
      expect(nativeLabelled).toHaveAccessibleName("Native label");
      expect(fieldLabelled).toHaveAccessibleName("Field label");
      expect(siblingLabelled).toHaveAccessibleName("Sibling label");
    },
  );

  describe.each(["native", "Field.Label"])("dynamic %s label", (labelType) => {
    function renderTestCase(
      initial: { ariaLabel?: string; showLabel?: boolean } = {},
    ) {
      const [ariaLabel, setAriaLabel] = createSignal<string | undefined>(
        initial.ariaLabel,
      );
      const [showLabel, setShowLabel] = createSignal(initial.showLabel ?? true);
      render(() => (
        <Field.Root>
          <Show when={showLabel()}>
            {labelType === "native" ? (
              <label for="dynamic-label">Associated label</label>
            ) : (
              <Field.Label>Associated label</Field.Label>
            )}
          </Show>
          <Checkbox.Root id="dynamic-label" aria-label={ariaLabel()} />
        </Field.Root>
      ));
      return {
        async setProps(props: {
          ariaLabel?: string | undefined;
          showLabel?: boolean;
        }) {
          if ("ariaLabel" in props) {
            setAriaLabel(props.ariaLabel);
          }
          if (props.showLabel !== undefined) {
            setShowLabel(props.showLabel);
          }
          flush();
          await Promise.resolve();
          flush();
        },
      };
    }

    it("updates the accessible name when `aria-label` is added, cleared, or removed", async () => {
      const { setProps } = renderTestCase();
      const checkbox = screen.getByRole("checkbox");

      expect(checkbox).toHaveAccessibleName("Associated label");

      await setProps({ ariaLabel: "Custom name" });
      expect(checkbox).toHaveAccessibleName("Custom name");

      await setProps({ ariaLabel: " \n\t " });
      expect(checkbox).toHaveAccessibleName("Associated label");

      await setProps({ ariaLabel: "Custom name" });
      expect(checkbox).toHaveAccessibleName("Custom name");

      await setProps({ ariaLabel: undefined });
      expect(checkbox).toHaveAccessibleName("Associated label");
    });

    // Deviation (native only): upstream re-runs the native-label lookup after every React commit.
    // Here it re-runs when the control's own inputs change, so a native `<label>` mounting or
    // unmounting elsewhere in the DOM is not noticed.
    it.skipIf(labelType === "native")(
      "updates the accessible name when the associated label mounts and unmounts",
      async () => {
        const { setProps } = renderTestCase({ showLabel: false });
        const checkbox = screen.getByRole("checkbox");

        expect(checkbox).toHaveAccessibleName("");

        await setProps({ showLabel: true });
        expect(checkbox).toHaveAccessibleName("Associated label");

        await setProps({ showLabel: false });
        expect(checkbox).toHaveAccessibleName("");
        expect(checkbox).not.toHaveAttribute("aria-labelledby");

        await setProps({ ariaLabel: "Custom name" });
        expect(checkbox).toHaveAccessibleName("Custom name");

        await setProps({ showLabel: true, ariaLabel: "Custom name" });
        expect(checkbox).toHaveAccessibleName("Custom name");

        await setProps({ showLabel: false, ariaLabel: "Custom name" });
        expect(checkbox).toHaveAccessibleName("Custom name");

        await setProps({ showLabel: true, ariaLabel: undefined });
        expect(checkbox).toHaveAccessibleName("Associated label");
      },
    );
  });

  it("can render a native button", async () => {
    const user = setup();
    const { container } = render(() => (
      <Checkbox.Root render="button" nativeButton />
    ));

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    expect(container.querySelector("button")).toBe(checkbox);

    await user.keyboard("[Tab]");
    expect(checkbox).toHaveFocus();

    await user.keyboard("[Enter]");
    expect(checkbox).toHaveAttribute("aria-checked", "false");

    await user.keyboard("[Space]");
    expect(checkbox).toHaveAttribute("aria-checked", "true");

    await user.click(checkbox);
    expect(checkbox).toHaveAttribute("aria-checked", "false");
  });
});
