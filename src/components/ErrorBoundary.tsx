import React from "react";
import { Box, Text } from "ink";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red" bold>
            Something went wrong
          </Text>
          <Text dimColor>{this.state.error?.message ?? "Unknown error"}</Text>
          <Box marginTop={1}>
            <Text>Press Ctrl+C to exit and restart the application.</Text>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}
