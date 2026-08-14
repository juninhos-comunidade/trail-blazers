import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import {
  CheckIcon,
  CommitIcon,
  GitHubIcon,
  GlobeIcon,
  LockIcon,
  MicIcon,
  MoonIcon,
  PlusIcon,
  ReplayIcon,
  SpeakerIcon,
  SpeakerMuteIcon,
  SunIcon,
  TrashIcon,
} from "./icons";

describe("icons", () => {
  it.each([
    ["GitHubIcon", GitHubIcon],
    ["PlusIcon", PlusIcon],
    ["LockIcon", LockIcon],
    ["CheckIcon", CheckIcon],
    ["GlobeIcon", GlobeIcon],
    ["TrashIcon", TrashIcon],
    ["MicIcon", MicIcon],
    ["SpeakerIcon", SpeakerIcon],
    ["SpeakerMuteIcon", SpeakerMuteIcon],
    ["ReplayIcon", ReplayIcon],
    ["SunIcon", SunIcon],
    ["MoonIcon", MoonIcon],
    ["CommitIcon", CommitIcon],
  ] as const)("%s renders an svg without throwing", (_name, Icon) => {
    const { container } = render(<Icon />);

    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
