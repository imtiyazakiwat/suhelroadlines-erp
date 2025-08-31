import React from 'react';
import './Toast.css';

const Toast = ({ opened, text, onToastClosed }) => {
  React.useEffect(() => {
    if (opened) {
      const timer = setTimeout(() => {
        if (onToastClosed) {
          onToastClosed();
        }
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [opened, onToastClosed]);

  if (!opened) return null;

  return (
    <div className="custom-toast">
      <div className="custom-toast-content">
        {text}
      </div>
    </div>
  );
};

export default Toast;
