import { Component, type ReactNode } from 'react';
import { Button } from 'platform-ui';

interface BoundaryProps {
  resetKey: string;
  onReset: () => void;
  children: ReactNode;
}

interface BoundaryState {
  error: Error | null;
}

export class ModuleBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidUpdate(previous: BoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="failure">
          <h3>Module failed</h3>
          <p>{this.state.error.message}</p>
          <Button variant="primary" onClick={this.props.onReset}>
            Retry module
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
