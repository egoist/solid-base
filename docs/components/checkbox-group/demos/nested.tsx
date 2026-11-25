import { createSignal, createUniqueId } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Checkbox } from '@egoist/solid-base/checkbox';
import { CheckboxGroup } from '@egoist/solid-base/checkbox-group';
import styles from './nested.module.css';

const mainPermissions = ['view-dashboard', 'manage-users', 'access-reports'];
const userManagementPermissions = ['create-user', 'edit-user', 'delete-user', 'assign-roles'];

export default function PermissionsForm() {
  const id = createUniqueId();
  const manageUsersId = createUniqueId();
  const [mainValue, setMainValue] = createSignal<string[]>([]);
  const [managementValue, setManagementValue] = createSignal<string[]>([]);

  return (
    <CheckboxGroup
      aria-labelledby={id}
      value={mainValue()}
      onValueChange={(value) => {
        if (value.includes('manage-users')) {
          setManagementValue(userManagementPermissions);
        } else if (managementValue().length === userManagementPermissions.length) {
          setManagementValue([]);
        }
        setMainValue(value);
      }}
      allValues={mainPermissions}
      class={styles.CheckboxGroup}
    >
      <label class={styles.Item} id={id}>
        <Checkbox.Root
          parent
          indeterminate={
            managementValue().length > 0 &&
            managementValue().length !== userManagementPermissions.length
          }
          class={styles.Checkbox}
        >
          <ParentIndicator />
        </Checkbox.Root>
        User permissions
      </label>

      <div class={styles.Children}>
        <Item value="view-dashboard">View dashboard</Item>
        <Item value="access-reports">Access reports</Item>

        <CheckboxGroup
          aria-labelledby={manageUsersId}
          value={managementValue()}
          onValueChange={(value) => {
            if (value.length === userManagementPermissions.length) {
              setMainValue((prev) => Array.from(new Set([...prev, 'manage-users'])));
            } else {
              setMainValue((prev) => prev.filter((v) => v !== 'manage-users'));
            }
            setManagementValue(value);
          }}
          allValues={userManagementPermissions}
          class={styles.CheckboxGroup}
        >
          <label class={styles.Item} id={manageUsersId}>
            <Checkbox.Root parent class={styles.Checkbox}>
              <ParentIndicator />
            </Checkbox.Root>
            Manage users
          </label>

          <div class={styles.Children}>
            <Item value="create-user">Create user</Item>
            <Item value="edit-user">Edit user</Item>
            <Item value="delete-user">Delete user</Item>
            <Item value="assign-roles">Assign roles</Item>
          </div>
        </CheckboxGroup>
      </div>
    </CheckboxGroup>
  );
}

function Item(props: { value: string; children: JSX.Element }) {
  return (
    <label class={styles.Item}>
      <Checkbox.Root value={props.value} class={styles.Checkbox}>
        <Checkbox.Indicator class={styles.Indicator}>
          <CheckIcon />
        </Checkbox.Indicator>
      </Checkbox.Root>
      {props.children}
    </label>
  );
}

function ParentIndicator() {
  return (
    <Checkbox.Indicator
      class={styles.Indicator}
      render={(props, state) => (
        <span {...props}>{state.indeterminate ? <DashIcon /> : <CheckIcon />}</span>
      )}
    />
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M2 8h12" />
    </svg>
  );
}
