'use client';

import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';

export default function HomePage() {
  const [AppComponent, setAppComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    let active = true;

    import('@/src/App').then((module) => {
      if (active) {
        setAppComponent(() => module.default);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (!AppComponent) {
    return null;
  }

  return <AppComponent />;
}
