import React from 'react';
import { SocketDemo } from '../components/SocketDemo';

export const SocketTestPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto py-8">
        <SocketDemo />
      </div>
    </div>
  );
};