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
        xl: {value: "2rem"},
        xxl: {value: "2.50rem"},
        xxxl: {value: "3rem"}
      },
      colors: {
        primary: {value: "#7965C1" },
        secondary: {value: "#483AA0"},
        accent: {value: "#E3D095"},
        background: {value: "#060e1f"},
        shadowed: {value: "#14102e"}
      },
      textShadows: {
        glow: { value: "0 0 8px #7965C1" }
      }
    },
  },
})

const system = createSystem(defaultConfig, config)

export default system