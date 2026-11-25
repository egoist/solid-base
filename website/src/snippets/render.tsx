import { Avatar } from '@egoist/solid-base/avatar';

type User = { handle: string; photo: string; initials: string };

export function UserAvatar(props: { user: User }) {
  return (
    <Avatar.Root
      class={(state) => ['avatar', { loaded: state.imageLoadingStatus === 'loaded' }]}
      render={(rootProps) => <a {...rootProps} href={`/@${props.user.handle}`} />}
    >
      <Avatar.Image src={props.user.photo} />
      <Avatar.Fallback delay={600}>{props.user.initials}</Avatar.Fallback>
    </Avatar.Root>
  );
}
