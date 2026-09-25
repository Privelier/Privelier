import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Avatar } from '../Avatar';

jest.mock('expo-image', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    Image: (props: Record<string, unknown>) => React.createElement(View, props),
  };
});

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: { accent: '#BFA06B' },
    fonts: { bodySemiBold: 'Inter_600SemiBold' },
  }),
}));

jest.mock('../../../theme/motion', () => ({ duration: { base: 180 } }));

describe('Avatar', () => {
  it('renders first and last initials in a circular brass-ring monogram', async () => {
    await render(<Avatar id="user-1" name="Taha Al Mansour" size={48} testID="avatar" />);
    const avatar = screen.getByTestId('avatar');
    const style = StyleSheet.flatten(avatar.props.style);

    expect(screen.getByTestId('avatar-monogram').props.children).toBe('TM');
    expect(avatar.props.accessibilityRole).toBe('image');
    expect(avatar.props.accessibilityLabel).toBe('Avatar for Taha Al Mansour');
    expect(style).toMatchObject({
      width: 48,
      height: 48,
      borderRadius: 24,
      borderColor: '#BFA06B',
      borderWidth: 0.5,
    });
  });

  it('keeps the warm tint deterministic for a stable user id', async () => {
    const first = await render(<Avatar id="stable-user" name="Ada Lovelace" testID="first" />);
    const firstTint = StyleSheet.flatten(screen.getByTestId('first').props.style).backgroundColor;
    await first.unmount();

    await render(<Avatar id="stable-user" name="Different Name" testID="second" />);
    expect(StyleSheet.flatten(screen.getByTestId('second').props.style).backgroundColor).toBe(
      firstTint
    );
  });

  it('uses expo-image caching, neutral BlurHash and a restrained crossfade for photos', async () => {
    await render(
      <Avatar
        id="barber-1"
        name="Ada Lovelace"
        imageUrl="https://cdn.example.com/ada.jpg"
        testID="avatar"
      />
    );
    const image = screen.getByTestId('avatar-image');

    expect(image.props.source).toEqual({ uri: 'https://cdn.example.com/ada.jpg' });
    expect(image.props.placeholder).toEqual({
      blurhash: expect.any(String),
      width: 16,
      height: 16,
    });
    expect(image.props.contentFit).toBe('cover');
    expect(image.props.placeholderContentFit).toBe('cover');
    expect(image.props.cachePolicy).toBe('memory-disk');
    expect(image.props.recyclingKey).toBe('barber-1');
    expect(image.props.transition).toEqual({
      duration: 180,
      effect: 'cross-dissolve',
    });
    expect(image.props.accessible).toBe(false);
  });

  it('falls back to the real-name monogram if a photo cannot load', async () => {
    await render(
      <Avatar
        id="barber-1"
        name="Ada Lovelace"
        imageUrl="https://cdn.example.com/missing.jpg"
        testID="avatar"
      />
    );

    await fireEvent(screen.getByTestId('avatar-image'), 'error');
    expect(screen.getByTestId('avatar-monogram').props.children).toBe('AL');
  });

  it('does not invent initials when a name is unavailable', async () => {
    await render(<Avatar id="user-1" name={null} testID="avatar" />);

    expect(screen.getByTestId('avatar-monogram').props.children).toBe('');
    expect(screen.getByTestId('avatar').props.accessibilityLabel).toBe('Profile avatar');
  });

  it('supports decorative responsive media without a nested accessibility target', async () => {
    await render(
      <Avatar
        id="barber-1"
        name="Ada Lovelace"
        shape="rounded"
        monogramFontSize={44}
        accessible={false}
        style={{ width: '100%', aspectRatio: 1.6 }}
        testID="media"
      />
    );
    const media = screen.getByTestId('media');
    const style = StyleSheet.flatten(media.props.style);

    expect(media.props.accessible).toBe(false);
    expect(media.props.accessibilityRole).toBeUndefined();
    expect(media.props.accessibilityLabel).toBeUndefined();
    expect(style).toMatchObject({ width: '100%', aspectRatio: 1.6, borderRadius: 8 });
    expect(StyleSheet.flatten(screen.getByTestId('media-monogram').props.style).fontSize).toBe(44);
  });
});
