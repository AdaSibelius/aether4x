'use client';
import React, { useEffect } from 'react';
import { AbstractMesh } from '@babylonjs/core';
import { AdvancedDynamicTexture, Rectangle, TextBlock, Control } from '@babylonjs/gui';

interface EntityLabelProps {
    name: string;
    mesh?: AbstractMesh;
    yOffset?: number;
    uiLayer?: AdvancedDynamicTexture;
}

/**
 * Imperative approach to Babylon GUI labels.
 * Ensures perfectly reliable 3D coordinate tracking by bypassing React reconciler bugs.
 */
export function EntityLabel({ name, mesh, yOffset = 20, uiLayer }: EntityLabelProps) {
    useEffect(() => {
        if (!mesh || !uiLayer) return;

        const rect = new Rectangle(`${name}-label-rect`);
        rect.background = "rgba(5, 8, 16, 0.6)";
        rect.thickness = 0;
        rect.cornerRadius = 4;
        rect.width = "120px";
        rect.height = "24px";

        const text = new TextBlock();
        text.text = name;
        text.color = "#8ab4d4";
        text.fontSize = 11;
        text.fontFamily = "'Outfit', sans-serif";
        text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;

        rect.addControl(text);
        uiLayer.addControl(rect);

        // Link to mesh MUST happen after the control is added to the UI root
        rect.linkWithMesh(mesh);
        rect.linkOffsetY = yOffset;

        return () => {
            rect.dispose();
        };
    }, [name, mesh, yOffset, uiLayer]);

    return null;
}
