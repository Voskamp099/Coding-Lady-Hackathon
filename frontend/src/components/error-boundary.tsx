'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  errorMsg: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error?.message || '未知错误' };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Page Error:', error?.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'linear-gradient(180deg, #F5EFD8, #F0E8CC, #F5EFE0)' }}>
          <div className="max-w-sm w-full rounded-2xl p-6 border text-center" style={{ background: 'rgba(255,251,240,0.8)', borderColor: 'rgba(196,163,90,0.2)' }}>
            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #D4C88E, #C4A35A)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-base font-bold mb-1" style={{ color: '#5B4A2E' }}>页面加载遇到问题</h2>
            <p className="text-xs mb-4" style={{ color: '#8B7B65' }}>成长数据加载时遇到了问题，请尝试刷新页面。</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, errorMsg: '' });
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="w-full py-2.5 rounded-xl text-white text-sm font-medium"
              style={{ background: 'linear-gradient(90deg, #C4A35A, #7B9E89)' }}
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
