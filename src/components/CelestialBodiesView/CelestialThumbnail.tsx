'use client';
import React from 'react';
import { BodyType } from '@/types/celestial';

interface CelestialThumbnailProps {
    bodyType: BodyType;
    isStar?: boolean;
    spectralType?: string;
    size?: number;
}

const COLORS: Record<string, string> = {
    Terrestrial: '#4a8fa8',
    GasGiant: '#c07834',
    IceGiant: '#5a8fba',
    Dwarf: '#7a7a8a',
    Ocean: '#2b65ec',
    Desert: '#d2b48c',
    Volcanic: '#c04000',
    Protoplanetary: '#8b4513',
    AsteroidBelt: '#8a7a5a',
    MainSequence: '#fff4ea',
    O: '#9bb0ff', B: '#aabfff', A: '#cad7ff', F: '#fbf8ff', G: '#fff4ea', K: '#ffd2a1', M: '#ffcc6f',
};

export function CelestialThumbnail({ bodyType, isStar, spectralType, size = 32 }: CelestialThumbnailProps) {
    const color = (isStar && spectralType ? COLORS[spectralType] : COLORS[bodyType]) || (isStar ? '#fff4ea' : '#6a7a8a');

    return (
        <div
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: `radial-gradient(circle at 30% 30%, ${color}, #000)`,
                boxShadow: isStar ? `0 0 10px ${color}` : 'inset -2px -2px 5px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)'
            }}
        />
    );
}
