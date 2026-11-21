import { Component, type ReactNode } from 'react';

/** Keeps a single render bug from blanking the whole game. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null; key: number }> {
  override state = { err: null as Error | null, key: 0 };
  static getDerivedStateFromError(err: Error) {
    return { err };
  }
  override componentDidCatch(err: Error) {
    console.error('UI error:', err);
  }
  override render() {
    if (this.state.err) {
      return (
        <div className="waiting">
          <div className="panel">
            <h2 className="stencil" style={{ margin: 0 }}>Něco se pokazilo</h2>
            <p className="muted">Hra běží dál na serveru – stačí obnovit zobrazení.</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn primary" onClick={() => this.setState((s) => ({ err: null, key: s.key + 1 }))}>Obnovit zobrazení</button>
              <button className="btn" onClick={() => location.reload()}>Načíst znovu</button>
            </div>
          </div>
        </div>
      );
    }
    return <div key={this.state.key} style={{ height: '100%' }}>{this.props.children}</div>;
  }
}
