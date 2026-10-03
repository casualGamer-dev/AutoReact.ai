import React from 'react';
import { Text } from 'react-native';
import { typography, colors } from '../theme/tokens';

// Heading/Body/Caption text presets - replaces the inline
// fontSize/fontFamily/color triplets repeated in every screen's StyleSheet.
function Heading({ style, ...rest }) {
  return <Text style={[typography.heading, style]} {...rest} />;
}

function Body({ style, ...rest }) {
  return <Text style={[typography.body, style]} {...rest} />;
}

function Caption({ style, ...rest }) {
  return <Text style={[typography.caption, style]} {...rest} />;
}

// Mono slug line: counts, statuses, marks.
function Slug({ style, ...rest }) {
  return <Text style={[typography.slug, style]} {...rest} />;
}

function ErrorText({ style, ...rest }) {
  return <Text style={[typography.caption, { color: colors.error }, style]} {...rest} />;
}

export default { Heading, Body, Caption, Slug, ErrorText };
