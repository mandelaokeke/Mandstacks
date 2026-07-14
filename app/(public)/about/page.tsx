import Link from "next/link";
import { Icon } from "@/components/icons";

export default function AboutPage() {
  return <><section className="simple-hero"><span className="eyebrow">About Mandstacks</span><h1>A library should feel like<br/><em>an open door.</em></h1><p>We pair the warmth of a neighborhood library with tools that make discovery and borrowing effortless.</p></section><section className="story-grid"><div className="story-art"><span>READ<br/>WIDELY</span></div><div><span className="eyebrow">Why we exist</span><h2>More time reading.<br/>Less time managing.</h2><p>Mandstacks was designed around a simple belief: library technology should disappear into the background. Members should find books quickly, understand what they have borrowed, and always know what comes next.</p><p>For librarians, that means a clear view of the collection, members, and every book in motion—without complicated workflows getting in the way.</p><Link href="/register" className="button button-primary">Become a member <Icon name="arrow" size={18}/></Link></div></section></>;
}
