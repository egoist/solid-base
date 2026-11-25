import { Repeat, createSignal, createUniqueId, onSettled } from 'solid-js';
import { OTPField } from '@egoist/solid-base/otp-field';
import styles from './custom-normalize.module.css';

const CODE_LENGTH = 6;

function normalizeRecoveryCode(value: string) {
  return value.toUpperCase();
}

export default function OTPFieldCustomNormalizeDemo() {
  const id = createUniqueId();
  const descriptionId = `${id}-description`;
  const feedback = createInvalidFeedback();

  // Alternate between two identical animations so every rejection restarts the shake.
  const invalidClass = (index: number) => {
    const pulse = feedback.invalidPulse();
    if (pulse === 0 || feedback.focusedIndex() !== index) {
      return undefined;
    }
    return pulse % 2 === 0 ? styles.InputInvalidB : styles.InputInvalidA;
  };

  return (
    <div class={styles.Field}>
      <label for={id} class={styles.Label}>
        Recovery code
      </label>
      <OTPField.Root
        id={id}
        length={CODE_LENGTH}
        validationType="alphanumeric"
        normalizeValue={normalizeRecoveryCode}
        onValueChange={feedback.handleValueChange}
        onValueInvalid={feedback.handleValueInvalid}
        aria-describedby={descriptionId}
        class={styles.Root}
      >
        <Repeat count={CODE_LENGTH}>
          {(index) => (
            <OTPField.Input
              class={[styles.Input, invalidClass(index)]}
              aria-label={index === 0 ? undefined : `Character ${index + 1} of ${CODE_LENGTH}`}
              onFocus={() => feedback.setFocusedIndex(index)}
            />
          )}
        </Repeat>
      </OTPField.Root>
      <p id={descriptionId} class={styles.Description}>
        Letters and digits only. Letters are converted to uppercase.
      </p>
      <span aria-live="polite" class={styles.ScreenReaderOnly}>
        {feedback.statusMessage()}
      </span>
    </div>
  );
}

/** Flashes the focused slot and announces a message when characters are rejected. */
function createInvalidFeedback() {
  const [focusedIndex, setFocusedIndex] = createSignal(0);
  const [invalidPulse, setInvalidPulse] = createSignal(0);
  const [statusMessage, setStatusMessage] = createSignal('');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let skipClearOnNextValueChange = false;

  onSettled(() => () => clearTimeout(timeout));

  function handleValueChange() {
    if (skipClearOnNextValueChange) {
      skipClearOnNextValueChange = false;
      return;
    }
    clearTimeout(timeout);
    setInvalidPulse(0);
    setStatusMessage('');
  }

  function handleValueInvalid(value: string) {
    skipClearOnNextValueChange = true;
    setInvalidPulse((pulse) => pulse + 1);
    setStatusMessage(`Unsupported characters were ignored from ${value}.`);
    clearTimeout(timeout);
    timeout = setTimeout(() => setInvalidPulse(0), 400);
  }

  return {
    focusedIndex,
    setFocusedIndex,
    invalidPulse,
    statusMessage,
    handleValueChange,
    handleValueInvalid,
  };
}
