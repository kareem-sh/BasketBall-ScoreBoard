// src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ControlScreen from './pages/ControlScreen';
import DisplayScreen from './pages/DisplayScreen';

function App() {
    return (
        <div className="App">
            <Routes>
                <Route path="/" element={<ControlScreen />} />
                <Route path="/control" element={<ControlScreen />} />
                <Route path="/display" element={<DisplayScreen />} />
            </Routes>
        </div>
    );
}

export default App;