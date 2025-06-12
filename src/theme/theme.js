import { createSystem, defineConfig, defaultConfig } from "@chakra-ui/react"

const config = defineConfig({
  theme: {
    tokens: {
      fonts: {
        body: { value: "'Roboto Mono', monospace" },
      },
      fontWeights: {
        normal: {value: 400},
        bold: {value: 700}
      },
      fontSizes: {
        sm: {value: "0.875rem"},
        md: {value: "1rem"},
        lg: {value: "1.25rem"},
        xl: {value: "2rem"}
      },
      colors: {
        primary: {value: "#7965C1" },
        secondary: {value: "#483AA0"},
        accent: {value: "#E3D095"},
        background: {value: "#060e1f"}
      }
    },
  },
})

const system = createSystem(defaultConfig, config)

export default system