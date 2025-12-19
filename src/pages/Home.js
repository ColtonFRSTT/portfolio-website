import { Linkedin, Instagram, Github, Music4, Icon } from "lucide-react"
import { Text, Box, Image, Progress, Flex, Link, IconButton } from "@chakra-ui/react"
import LiquidGlassBox from "../components/ui/LiquidGlassBox"
import LiquidGlassBoxStatic from "../components/ui/LiquidGlassBoxStatic"
import "./Home.css"
import { useState, useRef, useEffect } from "react"
import { Spinner } from "@chakra-ui/react"
import { KoltBot } from "../components/koltBot"

function msToMinutesSeconds(ms) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function Home() {

    const [songName, setSongName] = useState("")
    const [artistName, setArtistName] = useState("")
    const [imageUrl, setImageUrl] = useState("")
    const [songIsLoading, setSongIsLoading] = useState(true)
    const [songDuration, setSongDuration] = useState(0)
    const [songProgress, setSongProgress] = useState(0)

    const retryCount = useRef(0)
    const maxRetries = 5

    useState(() => {
        const fetchSongData = async () => {
            setSongIsLoading(true)
            try {
                const response = await fetch("https://txz4mvpkqg.execute-api.us-east-2.amazonaws.com/dev/spotifyGetCurrentSong")
                const data = await response.json()
                console.log("Fetched song data:", data)
                setSongName(data.name)
                setArtistName(data.artists)
                setImageUrl(data.albumImage)
                setSongDuration(data.durationMs)
                setSongProgress(data.progressMs)
                retryCount.current = 0
            } catch (error) {
                if (retryCount.current < maxRetries) {
                    retryCount.current += 1
                    console.error("Error fetching song data refreshing tokns:", error)
                    const refreshResponse = await fetch("https://txz4mvpkqg.execute-api.us-east-2.amazonaws.com/dev/spotifyRefresh")
                    const data = await refreshResponse.json()
                    console.log("response from refresh: ", data)
                    fetchSongData()
                } else {
                    console.error("Max retries reached")
                }
            } finally {
                setSongIsLoading(false)
            }
        }
        fetchSongData()
    }, [])

    return (
        <Box
            className = "background"
            display="flex"
            flexDirection="column"
            minHeight="100vh"
        >
            <Box
                height="100vh"
            >
                <Box
                    className="header"
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    fontWeight="bold"
                    height="64px"
                    position="sticky"
                >
                    <LiquidGlassBox
                        display="flex"
                        justifyContent="center"
                        gap={10}
                        alignItems="center"
                        marginLeft="100px"
                        marginTop="50px"
                        padding={3}
                    >
                        <Text fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"xl"} marginLeft={5} color="secondary"> Home </Text>
                        <Text fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"xl"} marginRight={5} color="secondary"> Projects </Text>
                    </LiquidGlassBox>
                    <LiquidGlassBox
                        marginRight="100px"
                        marginTop="50px"
                        display="flex"
                        height = "74px"
                        width = "336px"
                        justifyContent="center"
                        alignItems="center"
                        padding={3}
                        gap="60px"
                    >
                        <Link href = "https://github.com/ColtonFRSTT">
                            <Github style={{ filter: "drop-shadow(0 0 8px #483AA0)"}} color="#483AA0" size="2.5rem" />
                        </Link>
                        <Link href = "https://www.linkedin.com/in/colton-fridgen-74b838183/">
                            <Linkedin style={{ filter: "drop-shadow(0 0 8px #483AA0)"}} color="#483AA0" size="2.5rem" />
                        </Link>
                        <Link>
                            <Instagram style={{ filter: "drop-shadow(0 0 8px #483AA0)"}} color="#483AA0" size="2.5rem" />
                        </Link>
                    </LiquidGlassBox>
                </Box>
                <Box
                    className="profile-section"
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    justifyContent = "center"
                    minHeight="calc(100vh - 64px)"
                >
                    <LiquidGlassBox 
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        mt = "-200px"
                        height="500px"
                        width="1200px"
                    >
                        <Image
                            src="/images/profPic.jpg"
                            boxSize="250px"
                            borderRadius="full"
                            fit="cover"
                            alt="Profile"
                            mt = "-20px"
                            ml = "-150px"
                        />
                        <Box
                            display="flex"
                            flexDirection="column"
                            ml = "30px"
                            mt = "-80px"
                        >
                            <Text ml={2} fontWeight={"bold"} fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"xxxl"} color={"secondary"}>
                                Colton Fridgen
                            </Text>
                            <Text ml={5} mb={2} fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"lg"}>
                                Software Developer
                            </Text>
                        </Box>
                    </LiquidGlassBox>
                </Box>
                <Box
                    className="content"
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    minHeight="calc(100vh - 64px)"
                    bg="transparent"
                    pt={10}
                    pb={10}
                >
                    <Box
                        display = "flex"
                        flexDirection = "column"
                        width = "1300px"
                    >
                        <Text ml={2} fontWeight={"bold"} fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"xxl"} color={"secondary"}>
                            Ask KoltBot
                        </Text>
                        <Text ml={2} mb={2} fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"lg"}>
                            KoltBot is designed to answer questions about my projects, work experience, hobbies, and more
                        </Text>
                        <LiquidGlassBoxStatic>
                            <KoltBot />
                        </LiquidGlassBoxStatic>
                    </Box>
                    <Box
                        display="flex"
                        flexDirection="column"
                        position="fixed"
                        bottom="30px"
                        right="100px"
                        zIndex={20}
                    >
                        <LiquidGlassBox
                            className="liquid-glass"
                            display="flex"
                            flexDirection="column"
                            padding={4}
                            borderRadius="md"
                        >
                            <Box
                                display="flex"
                                alignItems="center"
                                mb={3}
                            >
                                <Music4 style={{ filter: "drop-shadow(0 0 8px #483AA0)"}} color = "#483AA0"></Music4>
                                <Text fontFamily={"body"} textShadow="0 0 8px #483AA0" color = "secondary" ml={2} mr={2} fontSize={"lg"} fontWeight={"Bold"}>Now Playing</Text>
                                <Music4 style={{ filter: "drop-shadow(0 0 8px #483AA0)"}} color = "#483AA0"></Music4>
                            </Box>

                            {(songIsLoading) && (
                                <Box display="flex" justifyContent="center" alignItems="center" minHeight="100px">
                                    <Spinner color = "secondary"></Spinner>
                                </Box>
                            )}
                            {(!songIsLoading) && (
                                <>
                                <Box
                                    display="flex"
                                    alignItems="flex-start"
                                >
                                    <Image
                                        src={imageUrl}
                                        alt="Current Song"
                                        boxSize="90px"
                                        borderRadius="md"
                                        objectFit="cover"
                                        fallbackSrc="https://via.placeholder.com/200" // Placeholder image while loading
                                    />
                                    <Box ml={3}>
                                        <Text fontFamily={"body"} textShadow="0 0 8px #483AA0" fontWeight="bold" fontSize="md">{songName}</Text>
                                        <Text fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize="sm"> By: {artistName}</Text>
                                        <Progress.Root max = {songDuration} min={0} value={songProgress} shape={"rounded"} size = {"sm"} mt={2}>
                                            <Progress.Track>
                                                <Progress.Range/>
                                            </Progress.Track>
                                        </Progress.Root>
                                        <Box
                                            display="flex"
                                            gap="250px"
                                        >
                                            <Text mt={1} fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"xs"}>{msToMinutesSeconds(songProgress)}</Text>
                                            <Text mt={1} fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"xs"}>{msToMinutesSeconds(songDuration)}</Text>
                                        </Box>
                                    </Box>
                                </Box>
                                </>
                            )}
                        </LiquidGlassBox>
                        <Box display="flex" justifyContent="flex-end">
                            <Text color = "secondary" fontSize="xs">Powered By Spotify</Text>
                        </Box>
                    </Box>

                    {/* Add extra content to enable scrolling */}
                </Box>
                <Box 
                    minHeight="100vh"
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    flexDirection="column"
                    py={20}
                >
                    <Text fontWeight={"bold"} fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"xxxl"} color={"secondary"}>
                        Projects
                    </Text>
                    <Text fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"lg"}>
                        Check out my projects
                    </Text>
                    <Flex 
                        gap={200}
                        mt={20}
                    >
                        <LiquidGlassBox width="600px" height="420px">
                            <Box
                                padding = {5}
                            >
                                <Text fontWeight={"bold"} fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"xxl"} color={"secondary"} textAlign="center">
                                    MyKeen
                                </Text>
                                <Text fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"md"} textAlign="center">
                                    Jan. - Aug. 2025
                                </Text>
                                <Text height = {"150px"} fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"lg"} textAlign="center" padding = {3} marginTop = {6}>
                                    A client service platform that leverages artificial intelligence and industry-informed automations to combine professional analysis, business insights with workflow automations. 
                                </Text>
                                <Box display="flex" justifyContent="center" mt={12}>
                                    <Box
                                        as="a"
                                        href="https://github.com/your-username/mykeen" // TODO: replace with actual repo URL
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        display="flex"
                                        alignItems="center"
                                        gap="8px"
                                        px={4}
                                        py={2}
                                        border="1px solid rgba(255,255,255,.35)"
                                        borderRadius="20px"
                                        textDecoration="none"
                                        transition="all 0.2s ease"
                                        _hover={{ transform: "translateY(-1px)", boxShadow: "0 0 8px #483AA0" }}
                                    >
                                        <Github style={{ filter: "drop-shadow(0 0 8px #483AA0)"}} color="#483AA0" size="1.1rem" />
                                        <Text fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"md"} color={"secondary"}>
                                            View on GitHub
                                        </Text>
                                    </Box>
                                </Box>
                            </Box>
                        </LiquidGlassBox>
                        <LiquidGlassBox width="600px" height="420px">
                            <Box
                                padding = {5}
                            >
                                <Text fontWeight={"bold"} fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"xxl"} color={"secondary"} textAlign="center">
                                    Mun Course Notifier
                                </Text>
                                <Text fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"md"} textAlign="center">
                                    Aug. 2024 - Present
                                </Text>
                                <Text height = {"150px"} fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"lg"} textAlign="center" padding = {3} marginTop = {6}>
                                    A fully automated platform that continuously monitors university course availability and notifies students via email when seats open.
                                </Text>
                                <Box display="flex" justifyContent="center" mt={12}>
                                    <Box
                                        as="a"
                                        href="https://github.com/your-username/mykeen" // TODO: replace with actual repo URL
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        display="flex"
                                        alignItems="center"
                                        gap="8px"
                                        px={4}
                                        py={2}
                                        border="1px solid rgba(255,255,255,.35)"
                                        borderRadius="20px"
                                        textDecoration="none"
                                        transition="all 0.2s ease"
                                        _hover={{ transform: "translateY(-1px)", boxShadow: "0 0 8px #483AA0" }}
                                    >
                                        <Github style={{ filter: "drop-shadow(0 0 8px #483AA0)"}} color="#483AA0" size="1.1rem" />
                                        <Text fontFamily={"body"} textShadow="0 0 8px #483AA0" fontSize={"md"} color={"secondary"}>
                                            View on GitHub
                                        </Text>
                                    </Box>
                                </Box>
                            </Box>
                        </LiquidGlassBox>
                    </Flex>
                </Box>
            </Box>
        </Box>
    )
}