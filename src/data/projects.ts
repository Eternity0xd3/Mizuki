// Project data configuration file
// Used to manage data for the project display page

export interface Project {
  id: string;
  title: string;
  description: string;
  image: string;
  category: "web" | "mobile" | "desktop" | "other";
  techStack: string[];
  status: "completed" | "in-progress" | "planned";
  liveDemo?: string;
  sourceCode?: string;
  visitUrl?: string;
  startDate: string;
  endDate?: string;
  featured?: boolean;
  tags?: string[];
  showImage?: boolean;
}

export const projectsData: Project[] = [
  {
    id: "song-guessing",
    title: "Arcaea猜盐",
    description: "劲爆猜盐, 但是arcaea",
    image: "/assets/projects/song-guessing.webp",
    category: "web",
    techStack: ["Node.js", "Express"],
    status: "completed",
    sourceCode: "https://github.com/Eternity0xd3/song-guessing",
    visitUrl: "https://arc.arcane67.top",
    startDate: "2026-07-21",
    endDate: "2026-08-03",
    featured: true,
    tags: ["Game", "Open Source"],
  },
];

// Get project statistics
export const getProjectStats = () => {
  const total = projectsData.length;
  const completed = projectsData.filter((p) => p.status === "completed").length;
  const inProgress = projectsData.filter(
    (p) => p.status === "in-progress",
  ).length;
  const planned = projectsData.filter((p) => p.status === "planned").length;

  return {
    total,
    byStatus: {
      completed,
      inProgress,
      planned,
    },
  };
};

// Get projects by category
export const getProjectsByCategory = (category?: string) => {
  if (!category || category === "all") {
    return projectsData;
  }
  return projectsData.filter((p) => p.category === category);
};

// Get featured projects
export const getFeaturedProjects = () => {
  return projectsData.filter((p) => p.featured);
};

// Get all tech stacks
export const getAllTechStack = () => {
  const techSet = new Set<string>();
  projectsData.forEach((project) => {
    project.techStack.forEach((tech) => {
      techSet.add(tech);
    });
  });
  return Array.from(techSet).sort();
};
