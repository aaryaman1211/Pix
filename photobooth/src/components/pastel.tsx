import { createContext, useContext } from 'react';
import { View, type ViewProps } from 'react-native';

// True inside a pastel card. Text, icons, chips and buttons read it so they stay dark-on-pastel in
// both themes, like the mockup's bright cards.
const PastelContext = createContext(false);

export function usePastel() {
  return useContext(PastelContext);
}

export function PastelScope({ children }: { children: React.ReactNode }) {
  return <PastelContext value={true}>{children}</PastelContext>;
}

export function PastelView({ color, style, children, ...rest }: ViewProps & { color: string }) {
  return (
    <PastelContext value={true}>
      <View style={[{ backgroundColor: color }, style]} {...rest}>
        {children}
      </View>
    </PastelContext>
  );
}
