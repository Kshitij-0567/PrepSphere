import React from 'react';

/** Catches a lazily loaded editor or whiteboard that fails to download, instead of breaking the room. */
class LoadBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div className="vi-editor-loading vi-load-failed" role="alert">
                <p>Couldn't load the {this.props.what}. Your work so far is saved on this device.</p>
                <button type="button" className="vi-btn vi-sm" onClick={() => window.location.reload()}>Reload the page</button>
            </div>
        );
    }
}

export default LoadBoundary;
