
import React from 'react';

interface LoaderProps {
  message: string;
  fastMode?: boolean;
}

const Loader: React.FC<LoaderProps> = ({ message, fastMode = false }) => {
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-80 flex flex-col items-center justify-center z-50">
      <div className={`w-16 h-16 border-4 border-t-4 border-gray-600 border-t-teal-400 rounded-full ${fastMode ? 'animate-spin duration-300' : 'animate-spin'}`}></div>
      <p className={`mt-4 text-lg text-gray-200 font-semibold ${fastMode ? 'animate-pulse' : ''}`}>
        {message}
        {fastMode && <span className="pickingDots"></span>}
      </p>
    </div>
  );
};

export default Loader;
